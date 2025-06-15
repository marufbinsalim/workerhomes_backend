'use strict';

/**
 * pending-subscription router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::pending-subscription.pending-subscription');
