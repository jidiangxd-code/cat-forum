// 云函数入口：用户登录，获取 openid
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('[login] OPENID:', openid);
  console.log('[login] APPID:', wxContext.APPID);
  console.log('[login] UNIONID:', wxContext.UNIONID);

  return {
    openid: openid,
    appId: wxContext.APPID,
    unionid: wxContext.UNIONID || ''
  };
};
