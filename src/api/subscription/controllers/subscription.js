'use strict'

/**
 * subscription controller
 */

const { createCoreController } = require('@strapi/strapi').factories

function addOneMonth(date, month = 1) {
  let newDate = new Date(date) // Create a new Date object to avoid mutating the original
  newDate.setMonth(newDate.getMonth() + month)
  return newDate
}

module.exports = createCoreController(
  'api::subscription.subscription',
  ({ strapi }) => ({
    async delete(ctx) {
      const { id } = ctx.request.params

      const foundedSubscription = await strapi.entityService.findOne(
        'api::subscription.subscription',
        id,
        {
          populate: ['dwellings'],
        }
      )

      if (!foundedSubscription?.id) {
        return ctx.notFound('Subscription not found!')
      }

      await strapi.entityService.delete('api::subscription.subscription', id)

      if (foundedSubscription?.dwellings?.length > 0) {
        for (const home of foundedSubscription?.dwellings) {
          await strapi.entityService.delete('api::dwelling.dwelling', home.id)
        }
      }

      await super.delete(ctx)

      return { data: { id } }
    },
    async create(ctx) {
      // assign the current user as the owner of the retreat
      const req = ctx.request.body
      console.log('request:=================', req)
      if (!req.data.user) {
        // strapi.entityService.findMany("api::user", stripe_customer_id)
        const res = await strapi.entityService.findMany(
          'plugin::users-permissions.user',
          {
            filters: {
              stripe_customer_id: req.data.stripe_customer_id,
            },
          }
        )
        console.log('kos kash japan:', res)
        Object.assign(ctx.request.body.data, {
          user: res[0].id,
        })
      }
      if (!req.data.package) {
        const res = await strapi.entityService.findMany(
          'api::package.package',
          {
            filters: {
              stripe_product_id: req.data.stripe_product_id,
            },
          }
        )
        console.log('kos kash china:', res)
        Object.assign(ctx.request.body.data, {
          package: res[0].id,
        })
      }
      const { data } = await super.create(ctx)
      console.log('response:=================', data)
      return { data: { id: data.id, ...data.attributes } }
    },
    async upgradePackage(ctx) {
      const { data } = ctx.request.body

      if (!data?.invoice) {
        return ctx.notFound()
      }

      const invoice = data?.invoice ? data.invoice : null

      // check if the invoice is already synced with the pending subscription
      const pending_subscription = await strapi.entityService
        .findMany('api::pending-subscription.pending-subscription', {
          filters: {
            $and: [
              { customer: { $eq: invoice?.customer } },
              { new_subscription: { $eq: invoice?.subscription } },
              { isSynced: { $eq: false } },
            ],
          },
        })
        ?.then(res => res?.[0])
        ?.catch(err => {
          console.log(err)
          return null
        })

      // if the invoice is not synced with the pending subscription, return 404
      if (!pending_subscription?.id) {
        return ctx.notFound()
      }

      let prev_subscription = null
      let new_subscription = null
      let dwellings = []

      if (
        !pending_subscription?.prev_subscription &&
        pending_subscription?.prev_strapi_subscription
      ) {
        prev_subscription = await strapi.entityService.findOne(
          'api::subscription.subscription',
          pending_subscription?.prev_strapi_subscription,
          {
            populate: ['dwellings'],
          }
        )

        dwellings = prev_subscription?.dwellings

        new_subscription = await strapi.entityService
          .findMany('api::subscription.subscription', {
            populate: ['package'],
            filters: {
              $and: [
                { stripe_customer_id: { $eq: invoice.customer } },
                { stripe_subscription_id: { $eq: invoice.subscription } },
              ],
            },
          })
          .then(res => res?.[0])
      } else if (
        pending_subscription?.prev_subscription &&
        !pending_subscription?.prev_strapi_subscription
      ) {
        const subscriptions = await strapi.entityService.findMany(
          'api::subscription.subscription',
          {
            populate: ['dwellings', 'package'],
            filters: {
              $and: [
                {
                  stripe_subscription_id: {
                    $in: [
                      pending_subscription?.prev_subscription,
                      invoice.subscription,
                    ],
                  },
                },
              ],
            },
          }
        )

        new_subscription = subscriptions?.find(
          sub => sub.stripe_subscription_id === invoice?.subscription
        )

        prev_subscription = subscriptions?.find(
          sub =>
            sub.stripe_subscription_id ===
            pending_subscription?.prev_subscription
        )

        dwellings = prev_subscription?.dwellings
      }

      const formattedData = {
        dwellings: dwellings?.length > 0 ? dwellings?.map(dw => dw.id) : [],
        stripe_customer_id: invoice?.customer,
        payment_currency: invoice?.currency,
        payment_status: invoice?.status,
        stripe_tracking_id: invoice?.payment_intent,
        payment_amount: invoice?.amount_paid
          ? (invoice?.amount_paid / 100).toString()
          : '0',
        end_date: new Date(prev_subscription?.end_date),
      }

      // update dwellings with the new package
      if (dwellings?.length > 0 && new_subscription?.package?.id) {
        for (const dwelling of dwellings) {
          await strapi.entityService.update(
            'api::dwelling.dwelling',
            dwelling.id,
            {
              data: {
                package: new_subscription?.package?.id,
              },
            }
          )
        }
      }

      // update new subscription
      await strapi.entityService.update(
        'api::subscription.subscription',
        new_subscription?.id,
        {
          data: formattedData,
        }
      )

      // update prev subscription
      await strapi.entityService.update(
        'api::subscription.subscription',
        prev_subscription?.id,
        {
          data: {
            dwellings: [],
            isExpired: true,
          },
        }
      )

      // update pending subscription
      await strapi.entityService.delete(
        'api::pending-subscription.pending-subscription',
        pending_subscription?.id,
        {
          data: {
            isSynced: true,
          },
        }
      )

      return formattedData
    },
    async downgradePackage(ctx) {
      const { data } = ctx.request.body

      if (data?.isFree === true) {
        if (!data?.prev_subscription || !data?.user) {
          // prev_subscription is required, it is subscription id not stripe_subscription_id
          return ctx.notFound('Previous subscription id is required')
        }

        const prev_subscription = await strapi.entityService.findOne(
          'api::subscription.subscription',
          data.prev_subscription
        )

        if (!prev_subscription?.id) {
          return ctx.notFound('Previous subscription not found')
        }

        const foundedPackage = await strapi.entityService
          .findMany('api::package.package', {
            filters: {
              isFree: {
                $eq: true,
              },
            },
          })
          ?.then(res => res?.[0])

        const user = await strapi.entityService.findOne(
          'plugin::users-permissions.user',
          data?.user
        )

        // create new free subscription
        const free_package = await strapi.entityService.create(
          'api::subscription.subscription',
          {
            data: {
              isFree: true,
              user: user?.id,
              stripe_customer_id: user?.stripe_customer_id,
              package: foundedPackage?.id,
              stripe_subscription_id: '',
              start_date: new Date(prev_subscription?.end_date),
              payment_status: 'free',
              payment_method: 'free',
              payment_currency: 'pln',
              payment_amount: '0',
              stripe_product_id: foundedPackage?.stripe_product_id,
              parent_subscription: prev_subscription?.id,
              publishedAt: new Date(),
            },
          }
        )

        return free_package
      }

      // IF NOT FREE PACKAGE
      const invoice = data?.invoice ? data.invoice : null

      // check if the invoice is already synced with the pending subscription
      const founded_pending_sub = await strapi.entityService
        .findMany('api::pending-subscription.pending-subscription', {
          filters: {
            $and: [
              { customer: { $eq: invoice?.customer } },
              { new_subscription: { $eq: invoice?.subscription } },
              { isSynced: { $eq: false } },
              { state: { $eq: 'downgrade' } },
            ],
          },
        })
        ?.then(res => res?.[0])
        ?.catch(err => {
          console.log(err)
          return null
        })

      const subs = await strapi.entityService.findMany(
        'api::subscription.subscription',
        {
          filters: {
            $and: [
              { stripe_customer_id: { $eq: invoice.customer } },
              {
                stripe_subscription_id: {
                  $in: [
                    founded_pending_sub?.prev_subscription,
                    founded_pending_sub?.new_subscription,
                  ],
                },
              },
            ],
          },
        }
      )

      const new_subscription = subs?.find(
        sub =>
          sub.stripe_subscription_id === founded_pending_sub?.new_subscription
      )

      const prev_subscription = subs?.find(
        sub =>
          sub.stripe_subscription_id === founded_pending_sub?.prev_subscription
      )

      const formattedData = {
        stripe_customer_id: invoice?.customer,
        payment_currency: invoice?.currency,
        payment_status: invoice?.status,
        stripe_tracking_id: invoice?.payment_intent,
        payment_amount: invoice?.amount_paid
          ? (invoice?.amount_paid / 100).toString()
          : '0',
        parent_subscription: prev_subscription?.id,
        start_date: new Date(prev_subscription?.end_date),
        end_date: addOneMonth(prev_subscription?.end_date),
      }

      // update subscription
      const updatedSubscription = await strapi.entityService.update(
        'api::subscription.subscription',
        new_subscription?.id,
        {
          data: formattedData,
        }
      )

      await strapi.entityService.update(
        'api::pending-subscription.pending-subscription',
        founded_pending_sub?.id,
        {
          data: {
            isSynced: true,
          },
        }
      )

      return updatedSubscription
    },
    async createFreeTrail(ctx) {
      const { data } = ctx.request.body

      const user = data?.user
      const plan = data?.package

      if (!user || !plan) {
        return ctx.notFound()
      }

      const foundedPackage = await strapi.entityService.findOne(
        'api::package.package',
        plan
      )
      const foundedUser = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        user
      )

      if (!foundedPackage?.id || !foundedUser?.id) {
        return ctx.notFound()
      }

      if (foundedUser?.isFreeTrailUsed) {
        return ctx.badRequest('User already used free trail')
      }

      const createdPackage = await strapi.entityService.create(
        'api::subscription.subscription',
        {
          data: {
            user: foundedUser?.id,
            package: foundedPackage?.id,
            isFree: true,
            start_date: new Date(),
            end_date: addOneMonth(new Date(), 3),
            payment_amount: '0',
            payment_currency: 'pln',
            payment_method: 'free',
            payment_status: 'trail',
            stripe_customer_id: foundedUser?.stripe_customer_id,
            stripe_product_id: foundedPackage?.stripe_product_id,
            publishedAt: new Date(),
          },
        }
      )

      if (createdPackage?.id) {
        await strapi.entityService.update(
          'plugin::users-permissions.user',
          user,
          {
            data: {
              isFreeTrailUsed: true,
            },
          }
        )
      }

      return true
    },
    async assignDwelling(ctx) {
      const { data } = ctx.request.body

      const stripe_customer_id = data?.session?.customer
      const stripe_subscription_id = data?.session?.subscription
      const stripe_session_id = data?.session?.id
      const dwelling = data?.session?.metadata?.dwelling

      if (!stripe_customer_id || !stripe_subscription_id || !dwelling) {
        return ctx.notFound(
          "Missing required data: 'customer', 'subscription', 'dwelling'"
        )
      }

      const currentDwelling = await strapi.entityService.findOne(
        'api::dwelling.dwelling',
        dwelling,
        {
          populate: ['subscription', 'localizations'],
        }
      )

      if (currentDwelling?.id && currentDwelling?.subscription?.id) {
        return ctx.badRequest('Dwelling already assigned to a subscription')
      }

      const currentSubscription = await strapi.entityService
        .findMany('api::subscription.subscription', {
          filters: {
            $and: [
              { stripe_customer_id: { $eq: stripe_customer_id } },
              { stripe_subscription_id: { $eq: stripe_subscription_id } },
            ],
          },
        })
        .then(res => res?.[0])

      if (!currentSubscription?.id) {
        return ctx.notFound('Subscription not found')
      }

      const dwellingIds = [
        ...currentDwelling?.localizations?.map(dw => dw.id),
        dwelling,
      ]

      const updatedSubscription = await strapi.entityService.update(
        'api::subscription.subscription',
        currentSubscription.id,
        {
          data: {
            dwellings: dwellingIds,
            stripe_session_id: stripe_session_id,
          },
        }
      )

      return updatedSubscription
    },
  })
)
