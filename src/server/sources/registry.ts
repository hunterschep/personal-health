import {
  SOURCE_REGISTRY_VERSION,
  sourceRegistryEntrySchema,
  type PublicSourceMetadata,
  type SourceRegistryEntry,
} from "./types";

const VERIFIED_AT = SOURCE_REGISTRY_VERSION;

const NO_ATTRIBUTION = {
  required: false,
  text: null,
  logoUrl: null,
  destinationUrl: null,
  contentMustRemainUnaltered: false,
} as const;

type UspstfSourceInput = {
  slug: string;
  title: string;
  path: string;
  publishedAt: string;
  serviceSlugs: string[];
  sourceVersion?: string;
  active?: boolean;
  lifecycle?: "current" | "draft";
  note?: string;
};

function uspstfSource(input: UspstfSourceInput): SourceRegistryEntry {
  const lifecycle = input.lifecycle ?? "current";
  return sourceRegistryEntrySchema.parse({
    slug: input.slug,
    organization: "U.S. Preventive Services Task Force",
    title: input.title,
    canonicalUrl: `https://www.uspreventiveservicestaskforce.org/uspstf/${input.path}`,
    sourceType: "federal_recommendation",
    evidenceClass: lifecycle === "draft" ? "uspstf_draft" : "uspstf_final",
    jurisdiction: "US",
    publishedAt: input.publishedAt,
    effectiveAt: input.publishedAt,
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: input.sourceVersion ?? `final-${input.publishedAt}`,
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle,
    active: input.active ?? lifecycle === "current",
    serviceSlugs: input.serviceSlugs,
    relatedUrls: [],
    internalReviewerNote:
      input.note ??
      "Final recommendation metadata only. Eligibility, grade, and schedule belong in a separately reviewed rule version.",
  });
}

function defineSource(source: SourceRegistryEntry): SourceRegistryEntry {
  return sourceRegistryEntrySchema.parse(source);
}

const uspstfSources: SourceRegistryEntry[] = [
  uspstfSource({
    slug: "uspstf-colorectal-cancer-screening-2021",
    title: "Colorectal Cancer: Screening",
    path: "recommendation/colorectal-cancer-screening",
    publishedAt: "2021-05-18",
    serviceSlugs: ["colorectal-cancer-screening"],
  }),
  uspstfSource({
    slug: "uspstf-breast-cancer-screening-2024",
    title: "Breast Cancer: Screening",
    path: "recommendation/breast-cancer-screening",
    publishedAt: "2024-04-30",
    serviceSlugs: ["breast-cancer-screening"],
  }),
  uspstfSource({
    slug: "uspstf-cervical-cancer-screening-2018",
    title: "Cervical Cancer: Screening",
    path: "recommendation/cervical-cancer-screening",
    publishedAt: "2018-08-21",
    serviceSlugs: ["cervical-cancer-screening"],
    note: "This 2018 final statement remains the active USPSTF source. Do not substitute the 2024 draft or the future-effective HRSA update.",
  }),
  uspstfSource({
    slug: "uspstf-cervical-cancer-screening-draft-2024",
    title: "Draft Recommendation: Cervical Cancer Screening",
    path: "draft-recommendation/cervical-cancer-screening-adults-adolescents",
    publishedAt: "2024-12-10",
    serviceSlugs: ["cervical-cancer-screening"],
    sourceVersion: "draft-2024-12-10",
    lifecycle: "draft",
    active: false,
    note: "Research watch only. A draft must never back an active rule or displace the 2018 final recommendation.",
  }),
  uspstfSource({
    slug: "uspstf-prostate-cancer-screening-2018",
    title: "Prostate Cancer: Screening",
    path: "recommendation/prostate-cancer-screening",
    publishedAt: "2018-05-08",
    serviceSlugs: ["prostate-cancer-discussion", "psa-test"],
  }),
  uspstfSource({
    slug: "uspstf-lung-cancer-screening-2021",
    title: "Lung Cancer: Screening",
    path: "recommendation/lung-cancer-screening",
    publishedAt: "2021-03-09",
    serviceSlugs: ["lung-cancer-screening"],
  }),
  uspstfSource({
    slug: "uspstf-skin-cancer-screening-2023",
    title: "Skin Cancer: Screening",
    path: "recommendation/skin-cancer-screening",
    publishedAt: "2023-07-25",
    serviceSlugs: ["skin-health-review", "skin-care"],
  }),
  uspstfSource({
    slug: "uspstf-hypertension-screening-2021",
    title: "Hypertension in Adults: Screening",
    path: "recommendation/hypertension-in-adults-screening",
    publishedAt: "2021-04-27",
    serviceSlugs: ["blood-pressure-screening"],
  }),
  uspstfSource({
    slug: "uspstf-prediabetes-type-2-diabetes-screening-2021",
    title: "Prediabetes and Type 2 Diabetes: Screening",
    path: "recommendation/screening-for-prediabetes-and-type-2-diabetes",
    publishedAt: "2021-08-24",
    serviceSlugs: ["prediabetes-type2-diabetes-screening", "hemoglobin-a1c", "fasting-glucose"],
  }),
  uspstfSource({
    slug: "uspstf-statin-primary-prevention-2022",
    title: "Statin Use for the Primary Prevention of Cardiovascular Disease in Adults",
    path: "recommendation/statin-use-in-adults-preventive-medication",
    publishedAt: "2022-08-23",
    serviceSlugs: ["lipid-cardiovascular-risk-review", "lipid-panel"],
  }),
  uspstfSource({
    slug: "uspstf-obesity-adults-interventions-2018",
    title: "Weight Loss to Prevent Obesity-Related Morbidity and Mortality in Adults",
    path: "recommendation/obesity-in-adults-interventions",
    publishedAt: "2018-09-18",
    serviceSlugs: ["weight-bmi-review"],
  }),
  uspstfSource({
    slug: "uspstf-tobacco-cessation-adults-2021",
    title: "Tobacco Smoking Cessation in Adults, Including Pregnant Persons: Interventions",
    path: "recommendation/tobacco-use-in-adults-and-pregnant-women-counseling-and-interventions",
    publishedAt: "2021-01-19",
    serviceSlugs: ["tobacco-use-review"],
  }),
  uspstfSource({
    slug: "uspstf-unhealthy-alcohol-use-2018",
    title:
      "Unhealthy Alcohol Use in Adolescents and Adults: Screening and Behavioral Counseling Interventions",
    path: "recommendation/unhealthy-alcohol-use-in-adolescents-and-adults-screening-and-behavioral-counseling-interventions",
    publishedAt: "2018-11-13",
    serviceSlugs: ["alcohol-use-review"],
  }),
  uspstfSource({
    slug: "uspstf-diet-activity-cvd-risk-2020",
    title:
      "Healthy Diet and Physical Activity for Cardiovascular Disease Prevention in Adults With Cardiovascular Risk Factors: Behavioral Counseling Interventions",
    path: "recommendation/healthy-diet-and-physical-activity-counseling-adults-with-high-risk-of-cvd",
    publishedAt: "2020-11-24",
    serviceSlugs: ["physical-activity-review", "nutrition-review"],
  }),
  uspstfSource({
    slug: "uspstf-diet-activity-no-cvd-risk-2022",
    title:
      "Healthy Diet and Physical Activity for Cardiovascular Disease Prevention in Adults Without Known Risk Factors: Behavioral Counseling Interventions",
    path: "recommendation/healthy-lifestyle-and-physical-activity-for-cvd-prevention-adults-without-known-risk-factors-behavioral-counseling",
    publishedAt: "2022-07-26",
    serviceSlugs: ["physical-activity-review", "nutrition-review"],
  }),
  uspstfSource({
    slug: "uspstf-osteoporosis-screening-2025",
    title: "Osteoporosis to Prevent Fractures: Screening",
    path: "recommendation/osteoporosis-screening",
    publishedAt: "2025-01-14",
    serviceSlugs: ["osteoporosis-screening"],
  }),
  uspstfSource({
    slug: "uspstf-abdominal-aortic-aneurysm-screening-2019",
    title: "Abdominal Aortic Aneurysm: Screening",
    path: "recommendation/abdominal-aortic-aneurysm-screening",
    publishedAt: "2019-12-10",
    serviceSlugs: ["abdominal-aortic-aneurysm-screening"],
  }),
  uspstfSource({
    slug: "uspstf-hepatitis-c-screening-2020",
    title: "Hepatitis C Virus Infection in Adolescents and Adults: Screening",
    path: "recommendation/hepatitis-c-screening",
    publishedAt: "2020-03-02",
    serviceSlugs: ["hepatitis-c-screening"],
  }),
  uspstfSource({
    slug: "uspstf-hiv-screening-2019",
    title: "Human Immunodeficiency Virus (HIV) Infection: Screening",
    path: "recommendation/human-immunodeficiency-virus-hiv-infection-screening",
    publishedAt: "2019-06-11",
    serviceSlugs: ["hiv-screening"],
  }),
  uspstfSource({
    slug: "uspstf-hepatitis-b-screening-2020",
    title: "Hepatitis B Virus Infection in Adolescents and Adults: Screening",
    path: "recommendation/hepatitis-b-virus-infection-screening",
    publishedAt: "2020-12-15",
    serviceSlugs: ["hepatitis-b-screening"],
  }),
  uspstfSource({
    slug: "uspstf-chlamydia-gonorrhea-screening-2021",
    title: "Chlamydia and Gonorrhea: Screening",
    path: "recommendation/chlamydia-and-gonorrhea-screening",
    publishedAt: "2021-09-14",
    serviceSlugs: ["sti-screening"],
  }),
  uspstfSource({
    slug: "uspstf-syphilis-screening-2022",
    title: "Syphilis Infection in Nonpregnant Adolescents and Adults: Screening",
    path: "recommendation/syphilis-infection-nonpregnant-adults-adolescents-screening",
    publishedAt: "2022-09-27",
    serviceSlugs: ["sti-screening"],
  }),
  uspstfSource({
    slug: "uspstf-depression-suicide-risk-adults-2023",
    title: "Depression and Suicide Risk in Adults: Screening",
    path: "recommendation/screening-depression-suicide-risk-adults",
    publishedAt: "2023-06-20",
    serviceSlugs: ["depression-screening"],
  }),
  uspstfSource({
    slug: "uspstf-anxiety-adults-screening-2023",
    title: "Anxiety Disorders in Adults: Screening",
    path: "recommendation/anxiety-adults-screening",
    publishedAt: "2023-06-20",
    serviceSlugs: ["anxiety-screening"],
  }),
  uspstfSource({
    slug: "uspstf-intimate-partner-violence-screening-2025",
    title: "Intimate Partner Violence and Caregiver Abuse of Older or Vulnerable Adults: Screening",
    path: "recommendation/intimate-partner-violence-and-abuse-of-elderly-and-vulnerable-adults-screening",
    publishedAt: "2025-06-24",
    serviceSlugs: ["intimate-partner-safety"],
  }),
  uspstfSource({
    slug: "uspstf-falls-prevention-older-adults-2024",
    title: "Falls Prevention in Community-Dwelling Older Adults: Interventions",
    path: "recommendation/falls-prevention-community-dwelling-older-adults-interventions",
    publishedAt: "2024-06-04",
    serviceSlugs: ["fall-risk-review", "fall-prevention-home-safety"],
  }),
  uspstfSource({
    slug: "uspstf-hearing-loss-screening-2021",
    title: "Hearing Loss in Older Adults: Screening",
    path: "recommendation/hearing-loss-in-older-adults-screening",
    publishedAt: "2021-03-23",
    serviceSlugs: ["hearing-review", "hearing-care"],
  }),
  uspstfSource({
    slug: "uspstf-visual-acuity-screening-2022",
    title: "Impaired Visual Acuity in Older Adults: Screening",
    path: "recommendation/impaired-visual-acuity-screening-older-adults",
    publishedAt: "2022-05-24",
    serviceSlugs: ["vision-review", "eye-exam"],
  }),
  uspstfSource({
    slug: "uspstf-cognitive-impairment-screening-2020",
    title: "Cognitive Impairment in Older Adults: Screening",
    path: "recommendation/cognitive-impairment-in-older-adults-screening",
    publishedAt: "2020-02-25",
    serviceSlugs: ["cognitive-concern-review", "functional-status-review"],
  }),
];

const federalAndSpecialtySources: SourceRegistryEntry[] = [
  defineSource({
    slug: "cdc-adult-immunization-schedule-2025-operative",
    organization: "Centers for Disease Control and Prevention",
    title: "Recommended Adult Immunization Schedule by Age Group, United States",
    canonicalUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-age.html",
    sourceType: "federal_immunization",
    evidenceClass: "cdc_acip_operational",
    jurisdiction: "US",
    publishedAt: "2025-07-02",
    effectiveAt: "2025-07-02",
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "operative-2025-07-02",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "current",
    active: true,
    serviceSlugs: [
      "influenza-vaccine",
      "covid-vaccine",
      "tdap-td-vaccine",
      "zoster-vaccine",
      "pneumococcal-vaccine",
      "rsv-vaccine",
      "hpv-vaccine",
      "hepatitis-a-vaccine",
      "hepatitis-b-vaccine",
      "mmr-vaccine",
      "varicella-vaccine",
    ],
    relatedUrls: [
      {
        label: "Adult immunization schedule notes",
        url: "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-notes.html",
        role: "implementation_notes",
      },
      {
        label: "Adult schedule addendum",
        url: "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-addendum.html",
        role: "version_notice",
      },
    ],
    internalReviewerNote:
      "The operative baseline remains the July 2, 2025 schedule under the federal injunction. Apply only separately reviewed operative addenda; do not infer logic from later unreviewed page edits.",
  }),
  defineSource({
    slug: "cdc-adult-immunization-notes-2025-operative",
    organization: "Centers for Disease Control and Prevention",
    title: "Adult Immunization Schedule Notes",
    canonicalUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-notes.html",
    sourceType: "federal_immunization",
    evidenceClass: "cdc_acip_operational",
    jurisdiction: "US",
    publishedAt: "2025-07-02",
    effectiveAt: "2025-07-02",
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "operative-2025-07-02",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "current",
    active: true,
    serviceSlugs: [
      "influenza-vaccine",
      "covid-vaccine",
      "tdap-td-vaccine",
      "zoster-vaccine",
      "pneumococcal-vaccine",
      "rsv-vaccine",
      "hpv-vaccine",
      "hepatitis-a-vaccine",
      "hepatitis-b-vaccine",
      "mmr-vaccine",
      "varicella-vaccine",
    ],
    relatedUrls: [],
    internalReviewerNote:
      "Interpret together with the operative age table and reviewed addendum. Notes are source material, never executable rules.",
  }),
  defineSource({
    slug: "cdc-adult-immunization-addendum-rsv-2026",
    organization: "Centers for Disease Control and Prevention",
    title: "Addendum to the Recommended Adult Immunization Schedule",
    canonicalUrl: "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-addendum.html",
    sourceType: "federal_immunization",
    evidenceClass: "cdc_acip_operational",
    jurisdiction: "US",
    publishedAt: "2026-04-27",
    effectiveAt: "2026-04-27",
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "rsv-amendment-2026-04-27",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "current",
    active: true,
    serviceSlugs: ["rsv-vaccine"],
    relatedUrls: [],
    internalReviewerNote:
      "Only the April 27, 2026 RSV amendment was identified as operative in the source review. Do not use this entry to activate unrelated schedule changes.",
  }),
  defineSource({
    slug: "cdc-hepatitis-b-universal-screening-2023",
    organization: "Centers for Disease Control and Prevention",
    title:
      "Screening and Testing for Hepatitis B Virus Infection: CDC Recommendations — United States, 2023",
    canonicalUrl: "https://www.cdc.gov/mmwr/volumes/72/rr/rr7201a1.htm",
    sourceType: "federal_recommendation",
    evidenceClass: "cdc_public_health_recommendation",
    jurisdiction: "US",
    publishedAt: "2023-03-10",
    effectiveAt: "2023-03-10",
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "mmwr-72-rr-1",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "current",
    active: true,
    serviceSlugs: ["hepatitis-b-screening"],
    relatedUrls: [],
    internalReviewerNote:
      "Keep this CDC screening variant distinct from the risk-based 2020 USPSTF recommendation. Any active variant requires its own reviewed rule.",
  }),
  defineSource({
    slug: "hrsa-womens-preventive-services-guidelines-2026-future",
    organization: "Health Resources and Services Administration",
    title: "Women’s Preventive Services Guidelines",
    canonicalUrl: "https://www.hrsa.gov/womens-guidelines",
    sourceType: "federal_recommendation",
    evidenceClass: "hrsa_supported_guideline",
    jurisdiction: "US",
    publishedAt: "2026-01-05",
    effectiveAt: "2027-01-01",
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "2026-update-effective-plan-years-2027",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "future",
    active: true,
    serviceSlugs: ["cervical-cancer-screening"],
    relatedUrls: [
      {
        label: "Federal Register controlling notice (91 FR 283)",
        url: "https://www.federalregister.gov/documents/2026/01/05/2025-24235/update-to-the-womens-preventive-services-guidelines",
        role: "version_notice",
      },
    ],
    internalReviewerNote:
      "Future-effective coverage guidance for plan years beginning in 2027. It must not displace the current cervical baseline before its effective boundary and reviewed rule activation.",
  }),
  defineSource({
    slug: "myhealthfinder-consumer-content-v4",
    organization: "Office of Disease Prevention and Health Promotion",
    title: "MyHealthfinder Consumer Health Content API v4",
    canonicalUrl: "https://odphp.health.gov/myhealthfinder",
    sourceType: "consumer_content",
    evidenceClass: "federal_consumer_content",
    jurisdiction: "US",
    publishedAt: null,
    effectiveAt: null,
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "api-v4",
    contentHash: null,
    licenseOrTermsUrl:
      "https://odphp.health.gov/our-work/national-health-initiatives/health-literacy/consumer-health-content/free-web-content/apis-developers/terms-use",
    attribution: {
      required: true,
      text: "Content provided by MyHealthfinder, Office of Disease Prevention and Health Promotion, U.S. Department of Health and Human Services.",
      logoUrl: "https://odphp.health.gov/themes/custom/healthfinder/images/MyHF.svg",
      destinationUrl: "https://odphp.health.gov/myhealthfinder",
      contentMustRemainUnaltered: true,
    },
    lifecycle: "current",
    active: true,
    serviceSlugs: [],
    relatedUrls: [
      {
        label: "API v4 usage documentation",
        url: "https://odphp.health.gov/our-work/national-health-initiatives/health-literacy/consumer-health-content/free-web-content/apis-developers/how-use-api",
        role: "implementation_notes",
      },
      {
        label: "MyHealthfinder API terms of use",
        url: "https://odphp.health.gov/our-work/national-health-initiatives/health-literacy/consumer-health-content/free-web-content/apis-developers/terms-use",
        role: "terms",
      },
    ],
    internalReviewerNote:
      "Imported text is consumer enrichment only. Preserve source boundaries and attribution; never convert the feed into active eligibility logic.",
  }),
  defineSource({
    slug: "acs-breast-cancer-screening-guideline",
    organization: "American Cancer Society",
    title: "American Cancer Society Recommendations for the Early Detection of Breast Cancer",
    canonicalUrl:
      "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection/american-cancer-society-recommendations-for-the-early-detection-of-breast-cancer.html",
    sourceType: "specialty_guideline",
    evidenceClass: "specialty_society_guideline",
    jurisdiction: "US",
    publishedAt: null,
    effectiveAt: null,
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "current-web-guideline-verified-2026-07-21",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "current",
    active: true,
    serviceSlugs: ["breast-cancer-screening"],
    relatedUrls: [],
    internalReviewerNote:
      "Specialty alternative only. Keep separate from the federal baseline; do not blend ages or intervals across variants.",
  }),
  defineSource({
    slug: "acs-cervical-cancer-screening-guideline-2025",
    organization: "American Cancer Society",
    title:
      "The American Cancer Society Guidelines for the Prevention and Early Detection of Cervical Cancer",
    canonicalUrl:
      "https://www.cancer.org/cancer/types/cervical-cancer/detection-diagnosis-staging/cervical-cancer-screening-guidelines.html",
    sourceType: "specialty_guideline",
    evidenceClass: "specialty_society_guideline",
    jurisdiction: "US",
    publishedAt: "2025-12-04",
    effectiveAt: "2025-12-04",
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "updated-2025-12-04",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "current",
    active: true,
    serviceSlugs: ["cervical-cancer-screening"],
    relatedUrls: [],
    internalReviewerNote:
      "Specialty alternative updated December 4, 2025. It requires a distinct reviewed variant and must not replace the current federal baseline automatically.",
  }),
  defineSource({
    slug: "acc-aha-dyslipidemia-guideline-2026",
    organization: "American College of Cardiology and American Heart Association",
    title: "2026 Guideline on the Management of Dyslipidemia",
    canonicalUrl:
      "https://professional.heart.org/en/guidelines-statements/2026-accahaaacvprabcacpmadaagsaphaaspcnlapcna-guideline-on-the-management-ofcir0000000000001423",
    sourceType: "specialty_guideline",
    evidenceClass: "specialty_society_guideline",
    jurisdiction: "US",
    publishedAt: "2026-03-13",
    effectiveAt: "2026-03-13",
    lastVerifiedAt: VERIFIED_AT,
    sourceVersion: "2026-guideline",
    contentHash: null,
    licenseOrTermsUrl: null,
    attribution: NO_ATTRIBUTION,
    lifecycle: "current",
    active: true,
    serviceSlugs: ["lipid-cardiovascular-risk-review", "lipid-panel"],
    relatedUrls: [],
    internalReviewerNote:
      "Specialty cardiovascular alternative only. Do not turn this citation into a universal annual lipid schedule.",
  }),
];

export const SOURCE_REGISTRY: readonly SourceRegistryEntry[] = Object.freeze(
  [...uspstfSources, ...federalAndSpecialtySources].map((source) => Object.freeze(source)),
);

const SOURCE_BY_SLUG = new Map(SOURCE_REGISTRY.map((source) => [source.slug, source]));

export function getSourceBySlug(slug: string): SourceRegistryEntry | null {
  return SOURCE_BY_SLUG.get(slug) ?? null;
}

export function getPublicSourceMetadata(source: SourceRegistryEntry): PublicSourceMetadata {
  const { internalReviewerNote, ...publicMetadata } = source;
  void internalReviewerNote;
  return publicMetadata;
}

export function getSourcesForService(serviceSlug: string): readonly SourceRegistryEntry[] {
  return SOURCE_REGISTRY.filter((source) => source.serviceSlugs.includes(serviceSlug));
}

export function toGuidelineSourceSeed(source: SourceRegistryEntry) {
  return {
    slug: source.slug,
    organization: source.organization,
    title: source.title,
    canonicalUrl: source.canonicalUrl,
    sourceType: source.sourceType,
    jurisdiction: source.jurisdiction,
    publishedAt: source.publishedAt,
    effectiveAt: source.effectiveAt,
    lastVerifiedAt: source.lastVerifiedAt,
    contentHash: source.contentHash,
    attributionText: source.attribution.text,
    licenseOrTermsUrl: source.licenseOrTermsUrl,
    active: source.active,
  };
}
