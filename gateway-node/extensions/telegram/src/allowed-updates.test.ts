import { API_CONSTANTS } from "grammy";
import { beforeAll, describe, expect, it } from "vitest";
let DEFAULT_TELEGRAM_UPDATE_TYPES: typeof import("./allowed-updates.js").DEFAULT_TELEGRAM_UPDATE_TYPES;
let resolveTelegramAllowedUpdates: typeof import("./allowed-updates.js").resolveTelegramAllowedUpdates;

beforeAll(async () => {
  ({ DEFAULT_TELEGRAM_UPDATE_TYPES, resolveTelegramAllowedUpdates } =
    await import("./allowed-updates.js"));
});

describe("resolveTelegramAllowedUpdates", () => {
  it("includes the default update types plus reaction and channel post support", () => {
    const updates = resolveTelegramAllowedUpdates();
    // The default list comes from grammy, so it moves whenever grammy adds a
    // new update type. Assert the contract instead of pinning the list: the
    // exported constant is the library default, and the update types this
    // product depends on are all present.
    expect(DEFAULT_TELEGRAM_UPDATE_TYPES).toEqual(API_CONSTANTS.DEFAULT_UPDATE_TYPES);
    expect(DEFAULT_TELEGRAM_UPDATE_TYPES).toEqual(
      expect.arrayContaining([
        "message",
        "edited_message",
        "channel_post",
        "edited_channel_post",
        "business_connection",
        "business_message",
        "edited_business_message",
        "deleted_business_messages",
        "guest_message",
        "inline_query",
        "chosen_inline_result",
        "callback_query",
        "shipping_query",
        "pre_checkout_query",
        "purchased_paid_media",
        "poll",
        "poll_answer",
        "my_chat_member",
        "managed_bot",
        "chat_join_request",
        "chat_boost",
        "removed_chat_boost",
      ]),
    );
    expect(updates).toEqual([...DEFAULT_TELEGRAM_UPDATE_TYPES, "message_reaction"]);
  });
});
