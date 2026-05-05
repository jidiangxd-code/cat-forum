const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 【统一初始化云函数】创建所有数据库集合
 * 
 * 核心改动：使用 db.createCollection() 创建集合（而非 add）
 * 
 * 使用方法：
 * 1. 右键点击 cloudfunctions/init-collections → 「上传并部署：云端安装依赖」
 * 2. 上传完成后 → 右键 → 「云端测试」→ 点击「调用」
 * 3. 查看返回结果，确认所有集合创建成功
 * 4. 【重要】权限设置需要手动在云开发控制台完成
 */
exports.main = async (event, context) => {
  // 完整的集合配置列表
  const collections = [
    {
      name: 'cats_profile',
      description: '猫咪档案',
      permission: '所有用户可读写',
      indexes: ['openid', 'catType', 'status']
    },
    {
      name: 'posts',
      description: '帖子',
      permission: '所有用户可读，仅创建者可写',
      indexes: ['openid', 'catId', 'category', 'createTime']
    },
    {
      name: 'comments',
      description: '评论',
      permission: '所有用户可读，仅创建者可写',
      indexes: ['postId', 'openid', 'createTime']
    },
    {
      name: 'votes',
      description: '投票',
      permission: '仅创建者可读写',
      indexes: ['catId', 'openid']
    },
    {
      name: 'favorites',
      description: '收藏',
      permission: '仅创建者可读写',
      indexes: ['userOpenid', 'postId']
    },
    {
      name: 'notifications',
      description: '通知',
      permission: '仅创建者可读写',
      indexes: ['toOpenid', 'isRead', 'createTime']
    },
    {
      name: 'reports',
      description: '举报',
      permission: '仅创建者可读写',
      indexes: ['targetId', 'openid', 'createTime']
    },
    {
      name: 'follows',
      description: '关注关系',
      permission: '仅创建者可读写',
      indexes: ['followerOpenid', 'followingOpenid']
    },
    {
      name: 'users',
      description: '用户信息',
      permission: '所有用户可读，仅创建者可写',
      indexes: ['openid']
    },
    {
      name: 'debug_logs',
      description: '错误日志',
      permission: '仅创建者可读写',
      indexes: ['level', 'time']
    }
  ]

  const results = []

  // 使用 db.createCollection() 创建集合
  for (const config of collections) {
    try {
      // 1. 先尝试创建集合
      await db.createCollection(config.name)
      
      results.push({
        collection: config.name,
        description: config.description,
        status: '✅ created',
        permission: config.permission,
        indexes: config.indexes
      })
    } catch (err) {
      // 集合已存在时报错，但属于正常情况
      // -501001 = ResourceExist（集合已存在）
      if (err.errCode === -501001 ||
          err.errCode === -1 || 
          err.message?.includes('already exists') || 
          err.message?.includes('ResourceExist') ||
          err.message?.includes('Table exist') ||
          err.message?.includes('已存在') ||
          err.message?.includes('Collection already exists')) {
        results.push({
          collection: config.name,
          description: config.description,
          status: '✅ already_exists',
          permission: config.permission,
          indexes: config.indexes
        })
      } else {
        results.push({
          collection: config.name,
          description: config.description,
          status: '❌ error',
          error: err.message,
          errCode: err.errCode
        })
      }
    }
  }

  // 统计结果
  const created = results.filter(r => r.status.includes('created')).length
  const existed = results.filter(r => r.status.includes('already_exists')).length
  const failed = results.filter(r => r.status.includes('error')).length

  // 权限设置指南
  const permissionGuide = `
========================================
📋 权限设置指南（需手动完成）
========================================

打开云开发控制台 → 数据库 → 对每个集合设置权限：

集合名称          | 权限设置
-----------------|--------------------------
cats_profile     | 所有用户可读写
posts            | 所有用户可读，仅创建者可写
comments         | 所有用户可读，仅创建者可写
votes            | 仅创建者可读写
favorites        | 仅创建者可读写
notifications    | 仅创建者可读写
reports          | 仅创建者可读写
follows          | 仅创建者可读写
users            | 所有用户可读，仅创建者可写
debug_logs       | 仅创建者可读写
========================================
`

  return {
    success: failed === 0,
    summary: {
      total: collections.length,
      created,
      alreadyExisted: existed,
      failed
    },
    details: results,
    permissionGuide,
    tip: failed === 0
      ? '✅ 所有集合创建完成！请按照上方指南手动设置权限。'
      : `❌ 有 ${failed} 个集合创建失败，请查看 details 中的错误信息。`
  }
}
