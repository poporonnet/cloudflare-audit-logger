import Cloudflare from "cloudflare";
import {
  type RESTPostAPIWebhookWithTokenJSONBody,
  RouteBases,
  Routes,
} from "discord-api-types/v10";
import { config } from "./config";

export default {
  async fetch() {
    return new Response("cloudflare-audit-logger is up.");
  },

  async scheduled(_event, env, ctx): Promise<void> {
    const cloudflare = new Cloudflare({
      apiToken: env.CLOUDFLARE_API_TOKEN,
    });
    const webhook = `${RouteBases.api}${Routes.webhook(env.DISCORD_WEBHOOK_ID, env.DISCORD_WEBHOOK_TOKEN)}`;

    const nowTimestamp = new Date().toISOString();
    const lastLoggedTimestamp =
      await env.CLOUDFLARE_AUDIT_LOGGER.get("LAST_LOGGED");

    const makeMinutesAgo = (min: number) => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - min);
      return now;
    };
    const since = lastLoggedTimestamp
      ? new Date(lastLoggedTimestamp)
      : makeMinutesAgo(5);
    since.setMilliseconds(since.getMilliseconds() + 1);

    const res = await cloudflare.accounts.logs.audit.list({
      account_id: "f208797981323b5cf2014d1be7fcfaff",
      since: since.toISOString(),
      before: nowTimestamp,
      direction: "asc",
    });

    const logs = res.result.filter(
      (log) =>
        !config.exclude.some(
          (exclude) =>
            log.resource?.product === exclude.resource.product &&
            log.resource?.type === exclude.resource.type,
        ),
    );

    const lastLoggedTime = logs.at(-1)?.action?.time;
    if (lastLoggedTime) {
      ctx.waitUntil(
        env.CLOUDFLARE_AUDIT_LOGGER.put("LAST_LOGGED", lastLoggedTime),
      );
    }

    for (const log of logs) {
      const body: RESTPostAPIWebhookWithTokenJSONBody = {
        username: "Cloudflare Audit Log",
        avatar_url: "https://github.com/tufusa.png",
        embeds: [
          {
            title: `[${log.action?.type}] ${log.resource?.product ?? ""}/${log.resource?.type ?? ""}`,
            description: log.action?.description,
            color: 16155167,
            timestamp: log.action?.time,
            author: {
              name: log.account?.name ?? "",
            },
            fields: [
              {
                name: "ID",
                value: `\`${log.id}\``,
              },
              {
                name: "Actor",
                value: `[${log.actor?.type}] ${log.actor?.email}`,
                inline: true,
              },
              {
                name: "Result",
                value: `${log.action?.result === "success" ? "✅" : "❌"} **${log.action?.result}**`,
                inline: true,
              },
            ],
          },
        ],
      };

      const res = await fetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      console.log(res);
    }
  },
} satisfies ExportedHandler<Env>;
