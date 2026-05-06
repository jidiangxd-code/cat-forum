// envList.js - 云环境列表配置
const envList = [];
// 这里标记当前开发环境是否为 macOS，供模板逻辑按需判断。
const isMac = false;
// 对外导出云环境列表和平台标记。
module.exports = {
  envList,
  isMac,
};
