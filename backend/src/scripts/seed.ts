import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  PriceListStatus,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createPriceListsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  createTranslationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ApiKey } from "../../.medusa/types/query-entry-points";
import {
  CATEGORIES,
  COLLECTIONS,
  Locale,
  LOCALES,
  PRODUCTS,
} from "./data/catalogue";
import DEMO_PHOTOS from "./data/demo-photos.json";
import { SHOP } from "../config/shop";
import { SELLER } from "../config/seller";
import { COD_PROVIDER_ID, RAZORPAY_PROVIDER_ID } from "../lib/payment-ids";
import { SHIPPING_PROVIDER_ID } from "../modules/shiprocket/ids";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["in"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "inr",
          is_default: true,
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        // Shown in the admin panel; placeholder until the brand name is final
        name: SELLER.brandName,
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "India",
          currency_code: "inr",
          countries,
          // Only real payment methods: never "pp_system_default", which accepts every order unpaid
          payment_providers: [RAZORPAY_PROVIDER_ID, COD_PROVIDER_ID],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Main Warehouse",
          address: {
            city: "Jalna",
            country_code: "IN",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: SHIPPING_PROVIDER_ID,
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "India delivery",
    type: "shipping",
    service_zones: [
      {
        name: "India",
        geo_zones: [
          {
            country_code: "in",
            type: "country",
          },
        ],
      },
    ],
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  // One delivery option: free from SHOP.freeShippingFrom, else SHOP.shippingFee
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard delivery",
        price_type: "flat",
        provider_id: SHIPPING_PROVIDER_ID,
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Delivered in 3-7 days.",
          code: "standard",
        },
        prices: [
          { currency_code: "inr", amount: SHOP.shippingFee },
          {
            currency_code: "inr",
            amount: 0,
            rules: [{ attribute: "item_total", operator: "gte", value: SHOP.freeShippingFrom }],
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey: ApiKey | null = null;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Webshop",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult as ApiKey;
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  await seedCatalogue(container, {
    shippingProfileId: shippingProfile.id,
    salesChannelId: defaultSalesChannel[0].id,
    stockLocationId: stockLocation.id,
    storeId: store.id,
  });
}

type SeedIds = {
  shippingProfileId: string;
  salesChannelId: string;
  stockLocationId: string;
  storeId: string;
};

const DEFAULT_STOCK = 40;

type DemoPhoto = {
  url: string;
  alt: string | null;
  credit: { name: string; profile: string; photo: string };
};
const PHOTOS = DEMO_PHOTOS as Record<string, DemoPhoto[]>;

async function seedCatalogue(container: ExecArgs["container"], ids: SeedIds) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const translationModule = container.resolve(Modules.TRANSLATION);

  logger.info("Seeding languages...");
  const existing = await translationModule.listLocales({
    code: LOCALES.map((l) => l.code),
  });
  const missing = LOCALES.filter(
    (l) => !existing.some((e) => e.code === l.code)
  );
  if (missing.length) {
    await translationModule.createLocales(missing);
  }
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: ids.storeId },
      update: {
        supported_locales: LOCALES.map((l) => ({ locale_code: l.code })),
      },
    },
  });

  logger.info("Seeding categories...");
  const categoryIds: Record<string, string> = {};
  for (const level of [false, true]) {
    const defs = CATEGORIES.filter((c) => Boolean(c.parent) === level);
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: defs.map((c) => ({
          name: c.name.en,
          handle: c.handle,
          rank: c.rank,
          is_active: true,
          parent_category_id: c.parent ? categoryIds[c.parent] : undefined,
        })),
      },
    });
    result.forEach((cat) => (categoryIds[cat.handle] = cat.id));
  }

  logger.info("Seeding collections...");
  const { result: collections } = await createCollectionsWorkflow(
    container
  ).run({
    input: {
      collections: COLLECTIONS.map((c) => ({
        title: c.title.en,
        handle: c.handle,
      })),
    },
  });
  const collectionIds = Object.fromEntries(
    collections.map((c) => [c.handle, c.id])
  );

  logger.info("Seeding products...");
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: PRODUCTS.map((p) => {
        // Each picture remembers its colour and photographer (shown on the credits page).
        const images = p.colours.flatMap((colour) =>
          (PHOTOS[`${p.handle}/${colour}`] ?? []).map((photo) => ({
            url: photo.url,
            metadata: {
              colour,
              alt: photo.alt,
              credit_name: photo.credit.name,
              credit_profile: photo.credit.profile,
              credit_photo: photo.credit.photo,
            },
          }))
        );
        if (!images.length) {
          throw new Error(`No demo photos for ${p.handle}`);
        }
        return {
          title: p.title.en,
          handle: p.handle,
          description: p.description.en,
          material: p.material.en,
          origin_country: "IN",
          // HSN code for courier and invoice papers
          hs_code: p.metadata.hsn,
          weight: p.weight,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: ids.shippingProfileId,
          // One collection per product in Medusa; extra ones go in metadata.
          collection_id: p.collections?.length
            ? collectionIds[p.collections[0]]
            : undefined,
          category_ids: p.categories.map((h) => categoryIds[h]),
          thumbnail: images[0].url,
          images,
          metadata: { ...p.metadata, badge: p.badge, collections: p.collections ?? [] },
          options: [
            { title: "Size", values: p.sizes },
            { title: "Colour", values: p.colours },
          ],
          variants: p.colours.flatMap((colour) =>
            p.sizes.map((size) => ({
              title: `${size} / ${colour}`,
              sku: `${p.handle}-${colour}-${size}`.toUpperCase(),
              options: { Size: size, Colour: colour },
              manage_inventory: true,
              // Grams, used for the courier's package weight
              weight: p.weight,
              prices: [{ amount: p.mrp, currency_code: "inr" }],
            }))
          ),
          sales_channels: [{ id: ids.salesChannelId }],
        };
      }),
    },
  });

  logger.info("Seeding sale prices...");
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "product.handle", "inventory_items.inventory_item_id"],
  });
  const productByHandle = Object.fromEntries(PRODUCTS.map((p) => [p.handle, p]));
  await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title: "Launch prices",
          description: "Selling prices below MRP",
          status: PriceListStatus.ACTIVE,
          prices: variants.map((v) => ({
            variant_id: v.id,
            amount: productByHandle[v.product!.handle].price,
            currency_code: "inr",
          })),
        },
      ],
    },
  });

  logger.info("Seeding stock...");
  const inventoryLevels: CreateInventoryLevelInput[] = variants.flatMap((v) => {
    const p = productByHandle[v.product!.handle];
    // SKU is HANDLE-COLOUR-SIZE; the override key is "SIZE/colour".
    const rest = v.sku!.slice(p.handle.length + 1).toLowerCase();
    const colour = p.colours.find((c) => rest.startsWith(`${c}-`))!;
    const size = p.sizes.find((s) => rest === `${colour}-${s.toLowerCase()}`)!;
    const stock = p.stock?.[`${size}/${colour}`] ?? DEFAULT_STOCK;
    return (v.inventory_items ?? []).map((ii) => ({
      location_id: ids.stockLocationId,
      stocked_quantity: stock,
      inventory_item_id: ii!.inventory_item_id,
    }));
  });
  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  });

  logger.info("Seeding Hindi and Marathi translations...");
  const productIds = Object.fromEntries(products.map((p) => [p.handle, p.id]));
  const locales: { code: Locale; key: "hi" | "mr" }[] = [
    { code: "hi-IN", key: "hi" },
    { code: "mr-IN", key: "mr" },
  ];
  const translations = locales.flatMap(({ code, key }) => [
    ...CATEGORIES.map((c) => ({
      reference: "product_category",
      reference_id: categoryIds[c.handle],
      locale_code: code,
      translations: { name: c.name[key] },
    })),
    ...COLLECTIONS.map((c) => ({
      reference: "product_collection",
      reference_id: collectionIds[c.handle],
      locale_code: code,
      translations: { title: c.title[key] },
    })),
    ...PRODUCTS.map((p) => ({
      reference: "product",
      reference_id: productIds[p.handle],
      locale_code: code,
      translations: {
        title: p.title[key],
        description: p.description[key],
        material: p.material[key],
      },
    })),
  ]);
  await createTranslationsWorkflow(container).run({ input: { translations } });

  logger.info(
    `Finished seeding ${products.length} products, ${variants.length} variants.`
  );
}
