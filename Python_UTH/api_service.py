from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from curl_cffi import requests
from datetime import datetime
import string
import random
import time
import os
import re
import threading

app = FastAPI()

# --- 1. HỆ THỐNG PROXY (ĐỌC TỪ FILE LOCAL) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROXY_FILE = os.path.join(BASE_DIR, "proxies.txt")
PROXY_LIST = []

def load_proxies():
    global PROXY_LIST
    if os.path.exists(PROXY_FILE):
        with open(PROXY_FILE, "r", encoding="utf-8") as f:
           
            raw_list = [
                line.strip().replace('http://', '').replace('https://', '')
                for line in f
                if line.strip() and not line.strip().startswith('#')
            ]
            PROXY_LIST = list(set(raw_list))
        print(f"[PROXY] Đã tải thành công {len(PROXY_LIST)} proxy từ file {PROXY_FILE}.")
    else:
        print(f"[WARNING] Không tìm thấy file {PROXY_FILE}! Hệ thống sẽ chạy bằng IP gốc của máy chủ.")


load_proxies()

def get_random_proxy():
    if not PROXY_LIST:
        return None
    ip = random.choice(PROXY_LIST)
    return {"http": f"http://{ip}", "https": f"http://{ip}"}

def build_proxy_candidates(max_proxy_attempts=3):
    """Tạo danh sách proxy thử không trùng nhau, sau cùng fallback IP gốc."""
    if not PROXY_LIST:
        return [None]

    shuffled = PROXY_LIST[:]
    random.shuffle(shuffled)
    selected = shuffled[:max_proxy_attempts]

    candidates = [{"http": f"http://{ip}", "https": f"http://{ip}"} for ip in selected]
    candidates.append(None)  # Fallback IP gốc
    return candidates


# --- 2. HỆ THỐNG QUẢN LÝ SESSION (Cache Token) ---
SESSION_STORE = {}
LOGIN_LOCKS = {}
LOGIN_LOCKS_GUARD = threading.Lock()


def get_user_login_lock(username):
    with LOGIN_LOCKS_GUARD:
        if username not in LOGIN_LOCKS:
            LOGIN_LOCKS[username] = threading.Lock()
        return LOGIN_LOCKS[username]


def normalize_proxy_payload(proxies):
    if not isinstance(proxies, dict):
        return None

    http_value = proxies.get("http")
    https_value = proxies.get("https")
    if not http_value and not https_value:
        return None

    return {
        "http": http_value,
        "https": https_value,
    }


def proxy_label(proxies):
    return proxies.get('http') if isinstance(proxies, dict) and proxies.get('http') else 'IP Gốc'

def generate_fake_captcha(length=30):
    chars = string.ascii_letters + string.digits + "-_"
    return ''.join(random.choice(chars) for _ in range(length))

def get_portal_token(username, password):
    # 1. Kiểm tra Cache (nếu token còn hạn thì trả về luôn, không tốn request)
    if username in SESSION_STORE and time.time() < SESSION_STORE[username]["expires"]:
        return SESSION_STORE[username]["token"], "cache"

    # Khóa theo từng username để tránh login trùng khi nhiều request đồng thời.
    user_lock = get_user_login_lock(username)
    with user_lock:
        # Double-check cache sau khi vào lock để tận dụng kết quả login của request trước đó.
        if username in SESSION_STORE and time.time() < SESSION_STORE[username]["expires"]:
            return SESSION_STORE[username]["token"], "cache"

        # 2. Login mới
        fake_captcha = generate_fake_captcha()
        url = f"https://portal.ut.edu.vn/api/v1/user/login?g-recaptcha-response={fake_captcha}"

        # Thử tối đa 3 proxy khác nhau, cuối cùng fallback IP gốc
        candidates = build_proxy_candidates(max_proxy_attempts=3)
        last_error = None
        for attempt, proxies in enumerate(candidates, start=1):
            label = proxy_label(proxies)
            try:
                with requests.Session() as s:
                  
                    res = s.post(
                        url,
                        json={"username": username, "password": password},
                        impersonate="chrome110",
                        proxies=proxies,
                        timeout=15
                    )

                    try:
                        data = res.json()
                    except Exception:
                        data = {}

                    if res.status_code == 200 and data.get("token"):
                        token = data["token"]
                        # Lưu cache token trong 1 tiếng 45 phút (6300s)
                        SESSION_STORE[username] = {
                            "token": token,
                            "expires": time.time() + 6300,
                            "login_proxies": normalize_proxy_payload(proxies),
                        }
                        print(f"[AUTH] {username} login thành công qua {label}")
                        return token, "success"
                    else:
                        body_message = ""
                        if isinstance(data, dict):
                            body_message = str(data.get("message") or data.get("detail") or "")

                        response_preview = (res.text or "")[:180].replace("\n", " ").strip()
                        error_text = f"{body_message} {response_preview}".lower()

                        print(
                            f"[AUTH] Thử lần {attempt} qua {label} nhận status {res.status_code}. "
                            f"Chi tiết: {body_message or response_preview or 'không có'}"
                        )

                        # Nếu portal trả rõ ràng là sai thông tin đăng nhập thì dừng luôn
                        invalid_hints = [
                            "sai mật khẩu", "sai mat khau", "invalid", "wrong password",
                            "incorrect", "username or password", "tài khoản", "tai khoan"
                        ]
                        if any(hint in error_text for hint in invalid_hints):
                            return None, "invalid_credentials"

                        last_error = f"HTTP {res.status_code}"

            except Exception as e:
                last_error = repr(e)
                print(
                    f"[AUTH] Thử lần {attempt} lỗi qua {label}: {e!r}. "
                    "Đang thử tuyến kế tiếp..."
                )
                time.sleep(1)

        print(f"[AUTH] {username} login thất bại sau {len(candidates)} lần thử. Lỗi cuối: {last_error}")
        return None, "network_or_blocked"


def normalize_text(value):
    if value is None:
        return None

    if not isinstance(value, str):
        value = str(value)

    cleaned = value.strip()
    if not cleaned:
        return None

    lower = cleaned.lower()
    placeholders = {
        "chưa cập nhật",
        "chua cap nhat",
        "n/a",
        "null",
        "none",
        "undefined"
    }
    if lower in placeholders:
        return None

    return cleaned


def normalize_key(key):
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def deep_find_first(payload, candidate_keys):
    if isinstance(payload, dict):
        for k, v in payload.items():
            if normalize_key(k) in candidate_keys:
                found = normalize_text(v)
                if found is not None:
                    return found

        for v in payload.values():
            found = deep_find_first(v, candidate_keys)
            if found is not None:
                return found

    elif isinstance(payload, list):
        for item in payload:
            found = deep_find_first(item, candidate_keys)
            if found is not None:
                return found

    return None


def extract_student_profile(raw_json, fallback_mssv):
    normalized_mssv_keys = {
        "masinhvien", "mssv", "studentid", "studentcode", "username", "taikhoan", "account"
    }
    normalized_name_keys = {
        "hoten", "hovaten", "hotensinhvien", "tensinhvien", "studentname", "fullname", "displayname"
    }
    normalized_family_name_keys = {
        "hodem", "holot", "lastname", "middlename", "surname"
    }
    normalized_given_name_keys = {
        "ten", "firstname", "givenname"
    }
    normalized_major_keys = {
        "tennganh", "nganh", "major", "majorname", "faculty", "facultyname", "khoa", "tenkhoa"
    }

    preferred_payload = raw_json.get("body") if isinstance(raw_json, dict) else raw_json

    parsed_mssv = deep_find_first(preferred_payload, normalized_mssv_keys) or deep_find_first(raw_json, normalized_mssv_keys)
    parsed_name = deep_find_first(preferred_payload, normalized_name_keys) or deep_find_first(raw_json, normalized_name_keys)
    parsed_ho_dem = deep_find_first(preferred_payload, normalized_family_name_keys) or deep_find_first(raw_json, normalized_family_name_keys)
    parsed_ten = deep_find_first(preferred_payload, normalized_given_name_keys) or deep_find_first(raw_json, normalized_given_name_keys)

   
    if not parsed_name and (parsed_ho_dem or parsed_ten):
        parsed_name = " ".join(part for part in [parsed_ho_dem, parsed_ten] if part)

    parsed_major = deep_find_first(preferred_payload, normalized_major_keys) or deep_find_first(raw_json, normalized_major_keys)

    return {
        "mssv": parsed_mssv or fallback_mssv,
        "display_name": parsed_name,
        "faculty": parsed_major,
    }


def fetch_dashboard_json(token, username):
    headers = {
        "authorization": f"Bearer {token}",
        "accept": "application/json, text/plain, */*",
        "Referer": "https://portal.ut.edu.vn/dashboard"
    }

    dashboard_endpoints = [
        "https://portal.ut.edu.vn/api/v1/dashboard",
        "https://portal.ut.edu.vn/api/v1/user/profile",
        "https://portal.ut.edu.vn/api/v1/user/info",
    ]

    # Dùng lại đúng tuyến đã login thành công, không quét proxy ngẫu nhiên để tránh lỗi/ồn log.
    session_data = SESSION_STORE.get(username, {}) if isinstance(SESSION_STORE.get(username, {}), dict) else {}
    login_proxies = normalize_proxy_payload(session_data.get("login_proxies"))
    if login_proxies:
        candidates = [login_proxies, None]  # thử đúng proxy đã login, rồi fallback IP gốc
    else:
        candidates = [None]  # login qua IP gốc thì chỉ dùng IP gốc

    last_error = None
    for endpoint in dashboard_endpoints:
        for attempt, proxies in enumerate(candidates, start=1):
            label = proxy_label(proxies)
            try:
                with requests.Session() as s:
                    res = s.get(
                        endpoint,
                        headers=headers,
                        impersonate="chrome110",
                        proxies=proxies,
                        timeout=12
                    )

                    if res.status_code == 401:
                        last_error = f"{endpoint} status 401 qua {label}"
                        continue

                    if res.status_code != 200:
                        last_error = f"{endpoint} status {res.status_code} qua {label}"
                        continue

                    try:
                        payload = res.json()
                    except Exception:
                        continue

                    if isinstance(payload, dict):
                        return {
                            "endpoint": endpoint,
                            "payload": payload
                        }
            except Exception as e:
                last_error = f"{endpoint} lỗi qua {label}: {e!r}"

    if last_error:
        print(f"[DASHBOARD] Không lấy được JSON dashboard bằng tuyến login hiện tại. {last_error}")

    return None


# --- 3. API ENDPOINTS ---
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth-and-info")
def auth_and_get_info(req: LoginRequest):
    """API kiểm tra đăng nhập & trả JSON dashboard + profile parse."""
    token, reason = get_portal_token(req.username, req.password)
    if not token:
        if reason == "invalid_credentials":
            raise HTTPException(status_code=401, detail="Sai MSSV hoặc mật khẩu portal.")
        raise HTTPException(status_code=503, detail="Không thể kết nối Portal qua proxy/IP gốc.")

    dashboard_data = fetch_dashboard_json(token, req.username)
    raw_dashboard_json = dashboard_data["payload"] if dashboard_data else {}
    source_endpoint = dashboard_data["endpoint"] if dashboard_data else None
    parsed_student = extract_student_profile(raw_dashboard_json, req.username)

    return {
        "status": "success",
        "source_endpoint": source_endpoint,
        "dashboard_json": raw_dashboard_json,
        "profile_fetched": bool(parsed_student.get("display_name") or parsed_student.get("faculty")),
        "mssv": parsed_student.get("mssv") or req.username,
        "ho_ten": parsed_student.get("display_name"),
        "nganh": parsed_student.get("faculty"),
        "student": parsed_student,
    }


@app.post("/api/get-schedule")
def get_schedule(req: LoginRequest, date: str, scope: str = "day"):
    """ API lấy lịch học. date format YYYY-MM-DD, scope = day|week """
    token, reason = get_portal_token(req.username, req.password)
    if not token:
        if reason == "invalid_credentials":
            raise HTTPException(status_code=401, detail="Sai MSSV hoặc mật khẩu portal.")
        raise HTTPException(status_code=503, detail="Không thể xác thực với Portal lúc này.")

    scope_value = (scope or "day").strip().lower()
    if scope_value not in ("day", "week"):
        scope_value = "day"

    url = f"https://portal.ut.edu.vn/api/v1/lichhoc/lichTuan?date={date}"
    headers = {
        "authorization": f"Bearer {token}",
        "Referer": "https://portal.ut.edu.vn/calendar",
        "accept": "application/json, text/plain, */*"
    }

    try:
        with requests.Session() as s:
            # Gọi API lấy lịch (có thể gắn thêm proxy ở đây nếu UTH chặn cả IP truy cập lấy lịch)
            res = s.get(url, headers=headers, impersonate="chrome110", timeout=15)
            
            if res.status_code == 401:
                SESSION_STORE.pop(req.username, None) # Clear token chết
                raise HTTPException(status_code=401, detail="Token hết hạn, xin gọi lại API để tự động login")

            raw_data = res.json().get("body", [])
            target_date_str = datetime.strptime(date, "%Y-%m-%d").strftime("%d/%m/%Y")

            clean_schedule = []
            for c in raw_data:
                class_date = c.get("ngayBatDauHoc")
                if scope_value == "week" or class_date == target_date_str:
                    clean_schedule.append({
                        "ngay_hoc": class_date or target_date_str,
                        "ten_mon": c.get("tenMonHoc"),
                        "thoi_gian": f"{c.get('tuGio')} - {c.get('denGio')}",
                        "phong_hoc": c.get("tenPhong"),
                        "trang_thai": "Tạm ngưng" if c.get("isTamNgung") else "Bình thường"
                    })

            def to_sort_key(item):
                date_value = item.get("ngay_hoc") or target_date_str
                time_value = item.get("thoi_gian") or ""
                start_time = time_value.split("-")[0].strip()
                try:
                    parsed_date = datetime.strptime(date_value, "%d/%m/%Y")
                except Exception:
                    parsed_date = datetime.strptime(target_date_str, "%d/%m/%Y")
                return (parsed_date, start_time)

            clean_schedule.sort(key=to_sort_key)

            return {"date": target_date_str, "scope": scope_value, "schedule": clean_schedule}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))