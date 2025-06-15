import type { Schema, Attribute } from '@strapi/strapi';

export interface SharedSeo extends Schema.Component {
  collectionName: 'components_shared_seos';
  info: {
    displayName: 'seo';
    icon: 'search';
    description: '';
  };
  attributes: {
    metaTitle: Attribute.Text;
    metaDescription: Attribute.Text;
    metaImage: Attribute.Media<'images' | 'files' | 'videos'>;
    metaSocial: Attribute.Component<'shared.meta-social', true>;
    keywords: Attribute.Text;
    metaRobots: Attribute.String;
    structuredData: Attribute.JSON;
    metaViewport: Attribute.String;
    canonicalURL: Attribute.String;
    locale: Attribute.String;
  };
}

export interface SharedMetaSocial extends Schema.Component {
  collectionName: 'components_shared_meta_socials';
  info: {
    displayName: 'metaSocial';
    icon: 'project-diagram';
  };
  attributes: {
    socialNetwork: Attribute.Enumeration<['Facebook', 'Twitter']> &
      Attribute.Required;
    title: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 60;
      }>;
    description: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 65;
      }>;
    image: Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface GlobalSocial extends Schema.Component {
  collectionName: 'components_global_socials';
  info: {
    displayName: 'Social';
    description: '';
  };
  attributes: {
    type: Attribute.Enumeration<
      [
        'WHATSAPP',
        'FACEBOOK',
        'INSTAGRAM',
        'GOOGLE LISTING',
        'WEBSITE',
        'EMAIL',
        'PHONE'
      ]
    >;
    value: Attribute.String;
  };
}

export interface GlobalLocation extends Schema.Component {
  collectionName: 'components_global_locations';
  info: {
    displayName: 'Location';
    icon: 'pinMap';
    description: '';
  };
  attributes: {
    street_one: Attribute.String & Attribute.Required;
    street_two: Attribute.String;
    zip_code: Attribute.String & Attribute.Required;
    geo: Attribute.JSON;
    country: Attribute.String;
    city: Attribute.String;
    state: Attribute.String;
  };
}

export interface GlobalContact extends Schema.Component {
  collectionName: 'components_global_contacts';
  info: {
    displayName: 'Contact';
    icon: 'phone';
  };
  attributes: {
    whatsup: Attribute.String;
    phone: Attribute.String;
    email: Attribute.String;
    website: Attribute.String;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'shared.seo': SharedSeo;
      'shared.meta-social': SharedMetaSocial;
      'global.social': GlobalSocial;
      'global.location': GlobalLocation;
      'global.contact': GlobalContact;
    }
  }
}
