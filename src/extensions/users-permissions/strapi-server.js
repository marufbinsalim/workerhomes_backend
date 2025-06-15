const dwelling = require('../../api/dwelling/controllers/dwelling')

module.exports = plugin => {
  plugin.controllers.auth.removeAccount = async ctx => {
    const { id } = ctx.params

    const currentUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      id,
      {
        populate: ['subscriptions', 'dwellings'],
      }
    )

    if (!currentUser) {
      return ctx.notFound(null, [{ messages: [{ id: 'User not found' }] }])
    }

    // BLOCK USER
    const blockedUser = await strapi.entityService.delete(
      'plugin::users-permissions.user',
      id
      // {
      //   data: {
      //     blocked: true,
      //     isActive: false,
      //   },
      // }
    )

    // DISABLE USER SUBSCRIPTIONS
    if (currentUser?.subscriptions?.length > 0) {
      for (const sub of currentUser.subscriptions) {
        await strapi.entityService.delete(
          'api::subscription.subscription',
          sub.id
          // {
          //   data: {
          //     isExpired: true,
          //     end_date: new Date(),
          //   },
          // }
        )
      }
    }

    // DISABLE USER DWELLINGS
    if (currentUser?.dwellings?.length > 0) {
      for (const dwelling of currentUser.dwellings) {
        await strapi.entityService.delete(
          'api::dwelling.dwelling',
          dwelling.id
          // {
          //   data: {
          //     isApproved: false,
          //   },
          // }
        )
      }
    }

    ctx.body = blockedUser
  }

  plugin.controllers.auth.verifyPassword = async ctx => {
    const { id } = ctx.params

    const { data } = ctx.request.body

    const currentUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      id
    )

    if (!currentUser || !data?.password) {
      return ctx.notFound(null, [{ messages: [{ id: 'User not found' }] }])
    }

    const validPassword = await strapi.plugins[
      'users-permissions'
    ].services.user.validatePassword(data?.password, currentUser.password)

    if (!validPassword) {
      return ctx.badRequest(null, [{ messages: [{ id: 'Invalid password' }] }])
    }

    ctx.body = true
  }

  plugin.controllers.auth.verifyAccount = async ctx => {
    const { data } = ctx.request.body

    const result = await strapi.entityService.findMany(
      'plugin::users-permissions.user',
      {
        filters: {
          email: data?.email,
        },
      }
    )

    if (!result || !result?.[0]?.id) {
      return ctx.notFound(null, [{ messages: [{ id: 'User not found' }] }])
    }

    const currentUser = result?.[0]

    if (currentUser?.blocked === true) {
      return ctx.notFound(null, [
        { messages: [{ email: 'Account not found' }] },
      ])
    }

    ctx.body = {
      id: currentUser?.id,
      name: currentUser?.name,
      email: currentUser?.email,
      provider: currentUser?.provider,
    }
  }

  plugin.controllers.auth.getStatistics = async ctx => {
    const { id } = ctx.params

    const currentUser = await strapi.entityService.findOne(
      'plugin::users-permissions.user',
      id
    )

    if (!currentUser) {
      return ctx.notFound(null, [{ messages: [{ id: 'User not found' }] }])
    }

    const totalDwellings = await strapi.entityService.findMany(
      'api::dwelling.dwelling',
      {
        populate: ['galleries.image'],
        filters: {
          $or: [
            {
              subscription: {
                user: {
                  id: {
                    $eq: currentUser.id,
                  },
                },
              },
            },
            {
              owner: {
                id: {
                  $eq: currentUser.id,
                },
              },
            },
          ],
        },
        sort: ['count:desc'],
      }
    )

    const formattedDwelling =
      totalDwellings?.length > 0
        ? totalDwellings?.map(item => {
            const owner =
              item?.subscription?.user?.id === currentUser?.id
                ? { type: 'creator', user: currentUser?.id }
                : { type: 'owner', user: currentUser?.id }
            return {
              id: item?.id,
              images: item?.galleries,
              count: item?.count,
              title: item?.title,
              date: item?.createdAt,
              owner,
            }
          })
        : []

    const totalContacts = await strapi.entityService.findMany(
      'api::listing-contact.listing-contact',
      {
        filters: {
          $or: [
            {
              dwelling: {
                subscription: {
                  user: {
                    id: {
                      $eq: currentUser?.id,
                    },
                  },
                },
              },
            },
            {
              dwelling: {
                owner: {
                  id: {
                    $eq: currentUser?.id,
                  },
                },
              },
            },
          ],
        },
      }
    )

    ctx.body = {
      dwelling: {
        count:
          formattedDwelling?.length > 0
            ? formattedDwelling.reduce(
                (accumulator, item) => accumulator + item.count,
                0
              )
            : 0,
        data:
          formattedDwelling?.length > 0 ? formattedDwelling?.slice(0, 10) : [],
      },
      contacts: {
        count: totalContacts?.length || 0,
        data: totalContacts,
      },
    }
  }

  plugin.routes['content-api'].routes.push({
    method: 'DELETE',
    path: '/auth/local/remove-account/:id',
    handler: 'auth.removeAccount',
    config: {
      prefix: '',
      policies: [],
    },
  })

  plugin.routes['content-api'].routes.push({
    method: 'POST',
    path: '/auth/local/verify-password/:id',
    handler: 'auth.verifyPassword',
    config: {
      prefix: '',
      policies: [],
    },
  })

  plugin.routes['content-api'].routes.push({
    method: 'POST',
    path: '/auth/local/verify-account',
    handler: 'auth.verifyAccount',
    config: {
      prefix: '',
      policies: [],
    },
  })

  plugin.routes['content-api'].routes.push({
    method: 'GET',
    path: '/auth/local/statistics/:id',
    handler: 'auth.getStatistics',
    config: {
      prefix: '',
      policies: [],
    },
  })

  return plugin
}
