const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 举报帖子/评论
 * @param {string} postId - 被举报帖子ID
 * @param {string} commentId - 被举报评论ID（可选）
 * @param {string} reporterId - 举报人 openid
 * @param {string} reporterName - 举报人昵称
 * @param {string} reason - 举报原因：abuse/ad/fake/other
 * @param {string} description - 补充说明（可选）
 */
exports.main = async (event, context) => {
  const { postId, commentId, reporterId, reporterName, reason, description } = event

  if (!postId || !reporterId || !reason) {
    return { success: false, error: '缺少必要参数' }
  }

  // 举报原因映射
  const reasonMap = {
    'abuse': '色情暴力',
    'ad': '广告骚扰',
    'fake': '虚假信息',
    'other': '其他'
  }

  try {
    // 检查是否重复举报（同一用户对同一内容）
    const _ = db.command
    const query = {
      reporterId,
      postId
    }
    if (commentId) {
      query.commentId = commentId
    }

    const existRes = await db.collection('reports')
      .where(query)
      .count()

    if (existRes.total > 0) {
      return { success: false, error: '您已举报过该内容，请耐心等待处理' }
    }

    // 获取被举报内容的基本信息
    let targetInfo = {}
    if (commentId) {
      // 举报评论
      try {
        const comment = await db.collection('comments').doc(commentId).get()
        targetInfo.content = comment.data.content ? comment.data.content.substring(0, 100) : ''
      } catch (e) {
        targetInfo.content = '（评论已删除）'
      }
    } else {
      // 举报帖子
      try {
        const post = await db.collection('posts').doc(postId).get()
        targetInfo.content = post.data.content ? post.data.content.substring(0, 100) : ''
        targetInfo.authorId = post.data.authorId || ''
      } catch (e) {
        targetInfo.content = '（帖子已删除）'
      }
    }

    // 写入举报记录
    const reportData = {
      postId,
      commentId: commentId || '',
      reporterId,
      reporterName: reporterName || '匿名用户',
      reason,
      reasonText: reasonMap[reason] || reason,
      description: description || '',
      targetContent: targetInfo.content || '',
      targetAuthorId: targetInfo.authorId || '',
      status: 'pending',       // pending | resolved | dismissed
      createTime: db.serverDate()
    }

    await db.collection('reports').add({ data: reportData })

    // 统计该内容的举报次数，超过阈值自动标记
    const reportCountRes = await db.collection('reports')
      .where({ postId, commentId: commentId || '', status: 'pending' })
      .count()

    // 举报次数 >= 3 自动标记帖子（但不自动删除，等管理员处理）
    if (reportCountRes.total >= 3 && !commentId) {
      try {
        await db.collection('posts').doc(postId).update({
          data: {
            reportCount: reportCountRes.total,
            reported: true,
            reportTime: db.serverDate()
          }
        })
      } catch (e) {
        // ignore
      }
    }

    return {
      success: true,
      message: '举报已提交，我们会尽快处理'
    }
  } catch (err) {
    console.error('举报失败', err)
    return { success: false, error: '举报提交失败，请稍后重试' }
  }
}
