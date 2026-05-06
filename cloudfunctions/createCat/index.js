// 云函数：创建猫咪档案（正式猫 / 未知代号猫）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 创建新的猫咪档案并写入基础资料。
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { success: false, code: 401, message: '请先登录' };

  const {
    catType = 'unknown',  // 'formal' | 'unknown'
    codeName,             // 未知猫代号（catType=unknown 时必填）
    fullName,             // 正式名字（catType=formal 时必填）
    appearance,           // 外貌（必选）
    gender,               // 性别：'male'|'female'|'unknown'
    personality,          // 性格描述
    location,             // 出没地点
    status,               // 状态：'active'|'lost'|'adopted'
    coverImage            // 封面图 fileID
  } = event;

  // 必填校验
  if (!appearance || !appearance.trim()) {
    return { success: false, code: 400, message: '外貌不能为空' };
  }
  if (catType === 'formal' && (!fullName || !fullName.trim())) {
    return { success: false, code: 400, message: '正式猫必须填写名字' };
  }
  if (catType === 'unknown' && (!codeName || !codeName.trim())) {
    return { success: false, code: 400, message: '未知猫必须填写代号' };
  }

  const now = new Date();
  const data = {
    catType,                                   // 'formal' | 'unknown'
    fullName: (fullName || '').trim() || null,
    codeName: (codeName || '').trim() || null,
    appearance: appearance.trim(),
    gender: gender || 'unknown',
    personality: (personality || '').trim(),
    location: (location || '').trim(),
    status: status || 'active',
    coverImage: coverImage || null,
    totalVote: 0,
    isMerged: false,
    mergedTo: null,
    createdBy: openid,
    editLog: [],                               // 编辑日志
    createTime: now,
    updateTime: now
  };

  try {
    const result = await db.collection('cats_profile').add({ data });
    return {
      success: true,
      code: 200,
      data: { _id: result._id },
      message: catType === 'formal' ? '正式档案创建成功' : '未知猫档案创建成功'
    };
  } catch (err) {
    return { success: false, code: 500, message: '创建失败: ' + err.message };
  }
};
