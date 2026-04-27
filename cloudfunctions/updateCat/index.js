// 云函数：更新猫咪档案（编辑信息 / 未知猫转正）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { success: false, code: 401, message: '请先登录' };

  const { catId, action, ...fields } = event;
  // action: 'edit' | 'promote'（转正）

  if (!catId) return { success: false, code: 400, message: 'catId 不能为空' };

  try {
    // 查询当前猫咪档案
    const catRes = await db.collection('cats_profile').doc(catId).get();
    const cat = catRes.data;
    if (!cat) return { success: false, code: 404, message: '猫咪档案不存在' };
    if (cat.isMerged) return { success: false, code: 400, message: '该档案已被合并，无法编辑' };

    const now = new Date();
    let updateData = { updateTime: now };

    if (action === 'promote') {
      // 未知猫转正
      if (cat.catType !== 'unknown') {
        return { success: false, code: 400, message: '只有未知猫才能执行转正操作' };
      }
      const { fullName, gender, personality, location, status, coverImage } = fields;
      if (!fullName || !fullName.trim()) {
        return { success: false, code: 400, message: '转正必须填写正式名字' };
      }
      updateData.catType = 'formal';
      updateData.fullName = fullName.trim();
      if (gender) updateData.gender = gender;
      if (personality !== undefined) updateData.personality = personality.trim();
      if (location !== undefined) updateData.location = location.trim();
      if (status) updateData.status = status;
      if (coverImage) updateData.coverImage = coverImage;

      // 记录编辑日志
      updateData.editLog = _.push({
        action: 'promote',
        operator: openid,
        time: now,
        note: `转正为正式猫，名字：${fullName.trim()}`
      });

    } else {
      // 普通编辑
      const { fullName, codeName, gender, personality, location, status, coverImage, appearance } = fields;
      if (fullName !== undefined) updateData.fullName = fullName.trim();
      if (codeName !== undefined) updateData.codeName = codeName.trim();
      if (gender !== undefined) updateData.gender = gender;
      if (personality !== undefined) updateData.personality = personality.trim();
      if (location !== undefined) updateData.location = location.trim();
      if (status !== undefined) updateData.status = status;
      if (coverImage !== undefined) updateData.coverImage = coverImage;
      if (appearance !== undefined && appearance.trim()) updateData.appearance = appearance.trim();

      // 记录编辑日志
      updateData.editLog = _.push({
        action: 'edit',
        operator: openid,
        time: now,
        fields: Object.keys(fields)
      });
    }

    await db.collection('cats_profile').doc(catId).update({ data: updateData });

    return {
      success: true,
      code: 200,
      message: action === 'promote' ? '转正成功！' : '信息更新成功'
    };
  } catch (err) {
    return { success: false, code: 500, message: '更新失败: ' + err.message };
  }
};
