export const config = {
  exclude: [
    { resource: { product: "workers", type: "scripts.deployments" } },
    { resource: { product: "workers", type: "scripts.versions" } },
    { resource: { product: "workers", type: "scripts.subdomain" } },
    { resource: { product: "workers", type: "scripts.script-settings" } },
  ],
};
