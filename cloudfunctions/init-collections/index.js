const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 一次性云函数：创建所有需要的数据库集合
 * 在微信开发者工具中右键点击此云函数 → 「上传并运行」即可
 * 运行成功后可删除此云函数
 */
exports.main = async (event, context) => {
<<<<<<< Updated upstream
  const collections = [
    'cats_profile',   // 猫咪档案
    'posts',          // 帖子
    'comments',       // 评论
    'votes',          // 投票
    'favorites',      // 收藏
    'notifications',  // 通知
    'reports',        // 举报
    'follows',        // 关注关系
    'debug_logs'      // 全局错误日志（自动上报）
  ]
=======
  const collections = ['cats_profile', 'posts', 'comments', 'votes', 'favorites', 'follows', 'notifications', 'users', 'cats']
>>>>>>> Stashed changes
  const results = []

  for (const name of collections) {
    try {
      // 尝试向集合插入一条初始化记录（集合不存在时会自动创建）
      const addRes = await db.collection(name).add({
        data: {
          _init: true,
          _initTime: db.serverDate(),
          _remark: '集合初始化记录，确认后可删除'
        }
      })
      results.push({ collection: name, status: 'created', id: addRes._id })
    } catch (err) {
      // 如果集合已存在，插入可能会因权限问题失败，但集合已经存在也算成功
      if (err.errCode === -1 || err.message?.includes('already exists') || err.message?.includes('permission')) {
        results.push({ collection: name, status: 'already_exists_or_permission_issue', error: err.message })
      } else {
        results.push({ collection: name, status: 'error', error: err.message, errCode: err.errCode })
      }
    }
  }

  return {
    success: true,
    message: '集合创建完成，请在云开发控制台确认。权限需手动设置！',
    details: results
  }
}
