export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">
          Tailwind CSS 测试
        </h1>
        <p className="text-gray-600 text-center mb-6">
          如果您能看到这个带有样式的页面，说明 Tailwind CSS 已正确配置。
        </p>
        <div className="flex justify-center space-x-4">
          <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
            主要按钮
          </button>
          <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
            次要按钮
          </button>
        </div>
      </div>
    </div>
  );
}