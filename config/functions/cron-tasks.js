const { forEach } = require('../middlewares')

module.exports = {
  anExample: {
    task: async ({ strapi }) => {
      console.log('CORN JOB IS START')
      const subscriptions = await strapi.entityService.findMany(
        'api::subscription.subscription',
        {
          populate: ['dwellings', 'pending_subscription.package', 'user'],
          filters: {
            $and: [
              {
                isExpired: {
                  $eq: false,
                },
              },
              {
                end_date: {
                  $eq: new Date(),
                },
              },
            ],
          },
        }
      )

      if (!subscriptions || !subscriptions.length) return

      const pk = await strapi.entityService
        .findMany('api::package.package', {
          filters: {
            isFree: true,
          },
        })
        ?.then(res => res?.[0])

      for (const sub of subscriptions) {
        if (sub?.pending_subscription?.id) {
          await strapi.entityService.update(
            'api::subscription.subscription',
            sub?.pending_subscription?.id,
            {
              data: {
                dwellings: sub?.dwellings || [],
                parent_subscription: null,
              },
            }
          )

          if (
            sub?.pending_subscription?.package?.id &&
            sub?.dwellings?.length > 0
          ) {
            for (const dwelling of sub?.dwellings) {
              await strapi.entityService.update(
                'api::dwelling.dwelling',
                dwelling.id,
                {
                  data: {
                    package: sub?.pending_subscription?.package?.id,
                  },
                }
              )
            }
          }
        } else if (sub?.isFree === true && !sub?.pending_subscription?.id) {
          return
        } else {
          await strapi.entityService.create('api::subscription.subscription', {
            data: {
              user: sub.user,
              package: pk?.id,
              dwellings: sub?.dwellings || [],
              isExpired: false,
              isFree: true,
              start_date: new Date(),
              payment_amount: '0',
              payment_currency: 'pln',
              payment_method: 'free',
              payment_status: 'free',
              stripe_customer_id: sub.user?.stripe_customer_id,
              user: sub?.user?.id,
              publishedAt: new Date(),
            },
          })
        }

        await strapi.entityService.update(
          'api::subscription.subscription',
          sub.id,
          {
            data: {
              isExpired: true,
            },
          }
        )

        console.log('CORN JOB IS END')
      }
    },

    options: {
      // rule: '*/1 * * * *',
      rule: '0 0 7 * * *',
      tz: 'Asia/Kabul',
    },
  },
}
