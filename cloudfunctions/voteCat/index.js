// 云函数：每日投票（防刷票）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 获取今日日期字符串 YYYY-MM-DD
function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { success: false, code: 401, message: '请先登录' };

  const { catId } = event;
  if (!catId) return { success: false, code: 400, message: 'catId 不能为空' };

  const today = getTodayStr();

  try {
    // 1. 查询目标猫是否存在且有效
    const catRes = await db.collection('cats_profile').doc(catId).get();
    const cat = catRes.data;
    if (!cat) return { success: false, code: 404, message: '猫咪档案不存在' };
    if (cat.isMerged) return { success: false, code: 400, message: '该猫咪已被合并，无法投票' };

    // 2. 查询今日是否已投票
    const voteRes = await db.collection('votes')
      .where({
        userOpenid: openid,
        voteDate: today
      })
      .limit(1)
      .get();

    if (voteRes.data && voteRes.data.length > 0) {
      return {
        success: false,
        code: 429,
        message: '今日已投过票，明天再来吧 🐱',
        data: { votedCatId: voteRes.data[0].catId }
      };
    }

    // 3. 写入投票记录
    const now = new Date();
    await db.collection('votes').add({
      data: {
        userOpenid: openid,
        catId,
        voteDate: today,
        createTime: now
      }
    });

    // 4. 猫咪 totalVote +1
    await db.collection('cats_profile').doc(catId).update({
      data: {
        totalVote: _.inc(1),
        updateTime: now
      }
    });

    return {
      success: true,
      code: 200,
      message: '投票成功！🎉',
      data: { catId, voteDate: today }
    };
  } catch (err) {
    return { success: false, code: 500, message: '投票失败: ' + err.message };
  }
};
