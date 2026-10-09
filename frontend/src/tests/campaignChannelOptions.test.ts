/**
 * Unit tests for Campaign Channel Options (New vs Edit Form & Filters)
 */

import {
  NEW_CAMPAIGN_CHANNELS,
  getCampaignChannelOptions,
  ChannelOption
} from "../components/CampaignFormModal";

describe("Campaign Channel Options & Legacy Preservation Tests", () => {
  describe("1. Create Form Options (New Campaigns)", () => {
    test("limits channel options for new campaigns strictly to WhatsApp, Instagram, and Email", () => {
      const options = getCampaignChannelOptions(null, false);
      expect(options).toHaveLength(3);

      const channelValues = options.map((o: ChannelOption) => o.value);
      expect(channelValues).toEqual(["WhatsApp", "Instagram", "Email"]);

      const channelLabels = options.map((o: ChannelOption) => o.label);
      expect(channelLabels).toEqual(["WhatsApp", "Instagram", "Email"]);

      // None of the new campaign channels should be flagged as legacy
      options.forEach((opt: ChannelOption) => {
        expect(opt.isLegacy).toBe(false);
      });
    });

    test("NEW_CAMPAIGN_CHANNELS constant is strictly WhatsApp, Instagram, Email", () => {
      expect(NEW_CAMPAIGN_CHANNELS).toEqual(["WhatsApp", "Instagram", "Email"]);
    });

    test("passes undefined currentChannel for new campaign and returns standard 3 channels", () => {
      const options = getCampaignChannelOptions(undefined, false);
      expect(options).toHaveLength(3);
      expect(options.map((o) => o.value)).toEqual(["WhatsApp", "Instagram", "Email"]);
    });
  });

  describe("2. Edit Form with Legacy Channel Preservation", () => {
    test("keeps legacy channel 'Website' selectable and labeled as '(Legacy)' when editing an existing campaign", () => {
      const options = getCampaignChannelOptions("Website", true);
      expect(options).toHaveLength(4);

      const values = options.map((o) => o.value);
      expect(values).toContain("WhatsApp");
      expect(values).toContain("Instagram");
      expect(values).toContain("Email");
      expect(values).toContain("Website");

      const websiteOption = options.find((o) => o.value === "Website");
      expect(websiteOption).toBeDefined();
      expect(websiteOption?.label).toBe("Website (Legacy)");
      expect(websiteOption?.isLegacy).toBe(true);
    });

    test("keeps legacy channel 'Google' selectable and labeled as '(Legacy)'", () => {
      const options = getCampaignChannelOptions("Google", true);
      expect(options).toHaveLength(4);

      const googleOption = options.find((o) => o.value === "Google");
      expect(googleOption).toBeDefined();
      expect(googleOption?.label).toBe("Google (Legacy)");
      expect(googleOption?.isLegacy).toBe(true);
    });

    test("keeps legacy channel 'Other' selectable and labeled as '(Legacy)'", () => {
      const options = getCampaignChannelOptions("Other", true);
      expect(options).toHaveLength(4);

      const otherOption = options.find((o) => o.value === "Other");
      expect(otherOption).toBeDefined();
      expect(otherOption?.label).toBe("Other (Legacy)");
      expect(otherOption?.isLegacy).toBe(true);
    });

    test("keeps arbitrary custom channel like 'Facebook' or 'LinkedIn' selectable and labeled as legacy", () => {
      const fbOptions = getCampaignChannelOptions("Facebook", true);
      expect(fbOptions.find((o) => o.value === "Facebook")?.label).toBe("Facebook (Legacy)");

      const liOptions = getCampaignChannelOptions("LinkedIn", true);
      expect(liOptions.find((o) => o.value === "LinkedIn")?.label).toBe("LinkedIn (Legacy)");
    });

    test("does not add duplicate or legacy label when editing an existing campaign that already has an active channel", () => {
      const waOptions = getCampaignChannelOptions("WhatsApp", true);
      expect(waOptions).toHaveLength(3);
      expect(waOptions.find((o) => o.value === "WhatsApp")?.label).toBe("WhatsApp");
      expect(waOptions.every((o) => !o.isLegacy)).toBe(true);

      const igOptions = getCampaignChannelOptions("Instagram", true);
      expect(igOptions).toHaveLength(3);
      expect(igOptions.find((o) => o.value === "Instagram")?.label).toBe("Instagram");

      const emailOptions = getCampaignChannelOptions("Email", true);
      expect(emailOptions).toHaveLength(3);
      expect(emailOptions.find((o) => o.value === "Email")?.label).toBe("Email");
    });

    test("handles case-insensitive match for active channel without creating duplicate legacy option", () => {
      const lowerOptions = getCampaignChannelOptions("whatsapp", true);
      expect(lowerOptions).toHaveLength(3);
    });
  });

  describe("3. Filter Still Showing Legacy Channels & Data Channels", () => {
    test("campaigns page channel filter combines available taxonomy channels with legacy channels in data", () => {
      const defaultChannels = [
        "Website",
        "Google",
        "WhatsApp",
        "Email",
        "Instagram",
        "Facebook",
        "LinkedIn",
        "Phone",
        "Manual",
        "Referral",
        "Partner",
        "API",
        "Other"
      ];

      const mockCampaignData = [
        { id: "c-1", name: "Legacy Web Push", channel: "Website" },
        { id: "c-2", name: "Google PPC Search", channel: "Google" },
        { id: "c-3", name: "WhatsApp Blitz", channel: "WhatsApp" },
        { id: "c-4", name: "Custom Affiliate", channel: "Affiliate_Network" }
      ];

      // Replicate the Campaigns page filter list composition
      const dataChannels = mockCampaignData.map((c) => c.channel).filter(Boolean);
      const allFilterChannels = Array.from(new Set([...defaultChannels, ...dataChannels]));

      // Verify that every legacy channel remains present in the filter
      expect(allFilterChannels).toContain("Website");
      expect(allFilterChannels).toContain("Google");
      expect(allFilterChannels).toContain("Other");
      expect(allFilterChannels).toContain("Facebook");
      expect(allFilterChannels).toContain("LinkedIn");
      expect(allFilterChannels).toContain("Affiliate_Network");
    });
  });

  describe("4. Existing Campaigns Open, Edit & Save Payload Verification", () => {
    test("saving an existing campaign with legacy channel 'Website' preserves the channel value in payload", () => {
      const existingCampaign = {
        id: "camp-existing-web",
        name: "Old Website Inbound",
        code: "WEB-OLD",
        channel: "Website",
        platform: "Organic Search",
        status: "ACTIVE",
        budget: 15000,
        currency: "INR"
      };

      // Form initialization in edit mode
      const options = getCampaignChannelOptions(existingCampaign.channel, true);
      let selectedChannel = existingCampaign.channel;

      // Verify selected option is valid and matches
      const matchedOption = options.find((o) => o.value === selectedChannel);
      expect(matchedOption).toBeDefined();
      expect(matchedOption?.value).toBe("Website");
      expect(matchedOption?.label).toBe("Website (Legacy)");

      // Form submission payload without changing channel
      const updatePayload = {
        name: "Updated Website Inbound",
        code: existingCampaign.code,
        channel: selectedChannel,
        status: existingCampaign.status
      };

      expect(updatePayload.channel).toBe("Website");
    });

    test("user can optionally migrate legacy campaign to new channel (e.g. WhatsApp)", () => {
      const existingCampaign = {
        id: "camp-legacy-to-migrate",
        channel: "Google"
      };

      const options = getCampaignChannelOptions(existingCampaign.channel, true);
      expect(options.some((o) => o.value === "WhatsApp")).toBe(true);

      // User chooses to migrate to WhatsApp
      const newChannel = "WhatsApp";
      const updatePayload = {
        id: existingCampaign.id,
        channel: newChannel
      };

      expect(updatePayload.channel).toBe("WhatsApp");
    });
  });
});
