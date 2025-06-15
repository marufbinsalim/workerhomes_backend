'use strict'

/**
 * price controller
 */

const { createCoreController } = require('@strapi/strapi').factories

module.exports = createCoreController('api::price.price', ({ strapi }) => {
  return {
    async createMany(ctx) {
      const { data } = ctx.request.body

      if (!Array.isArray(data)) {
        return ctx.badRequest('data must be an array')
      }

      for (const price of data) {
        if (!price?.dwellings || !price?.amount) {
          return ctx.badRequest('data must have a product and a price')
        }

        if (price?.id) {
          const updatePrice = await strapi.entityService.update(
            'api::price.price',
            price?.id,
            {
              data: {
                type: price?.type,
                min_stay: price?.min_stay,
                note: price?.note,
                guest: price?.guest,
                adult: price?.adult,
                total: price?.total,
                amount: price?.amount,
              },
            }
          )
        } else {
          const createPrice = await strapi.entityService.create(
            'api::price.price',
            {
              data: {
                publishedAt: new Date(),
                dwellings: price?.dwellings,
                type: price?.type,
                min_stay: price?.min_stay,
                note: price?.note,
                guest: price?.guest,
                adult: price?.adult,
                total: price?.total,
                amount: price?.amount,
              },
            }
          )
        }
      }

      return { status: 200, messages: 'OK' }
    },
  }
})
