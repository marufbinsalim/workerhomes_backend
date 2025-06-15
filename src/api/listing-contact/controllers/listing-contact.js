'use strict'

const { createCoreController } = require('@strapi/strapi').factories

module.exports = createCoreController(
  'api::listing-contact.listing-contact',
  ({ strapi }) => ({
    async updateResponse(ctx) {
      const { id } = ctx.request.params

      const currentContact = await strapi.entityService.findOne(
        'api::listing-contact.listing-contact',
        id
      )

      if (!currentContact?.id) {
        return ctx.notFound()
      }

      const res = await strapi.entityService.update(
        'api::listing-contact.listing-contact',
        id,
        {
          data: {
            isResponded: !currentContact?.isResponded,
          },
        }
      )

      return res
    },
  })
)
