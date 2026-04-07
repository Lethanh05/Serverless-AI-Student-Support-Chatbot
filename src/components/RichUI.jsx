// Component hiển thị Bảng Lịch học (Rich UI)
const ScheduleTable = ({ data }) => (
  <div className="mt-2 overflow-x-auto border rounded-lg">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-2 text-left font-semibold text-gray-900">Ngày</th>
          <th className="px-3 py-2 text-left font-semibold text-gray-900">Môn học</th>
          <th className="px-3 py-2 text-left font-semibold text-gray-900">Phòng</th>
          <th className="px-3 py-2 text-left font-semibold text-gray-900">Giờ</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {data.map((item, i) => (
          <tr key={i}>
            <td className="px-3 py-2 text-blue-700 font-medium">{item.date}</td>
            <td className="px-3 py-2 text-gray-700">{item.subject}</td>
            <td className="px-3 py-2 text-gray-700">{item.room}</td>
            <td className="px-3 py-2 text-gray-700">{item.time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default ScheduleTable;