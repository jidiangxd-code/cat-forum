// 云函数：读取 debug_logs 集合（调试用）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { limit = 20, level, page = 1 } = event;
  
  try {
    let query = db.collection('debug_logs').orderBy('time', 'desc');
    
    if (level) {
      query = query.where({ level });
    }
    
    const res = await query
      .skip((page - 1) * limit)
      .limit(limit)
      .get();
    
    // 获取总数
    const countRes = await db.collection('debug_logs').count();
    
    return {
      success: true,
      total: countRes.total,
      data: res.data || []
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      errCode: err.errCode
    };
  }
};
