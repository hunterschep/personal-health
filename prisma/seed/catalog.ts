import type { Prisma, ServiceCategory } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/server/db";
import {
  createServiceCatalogRepository,
  type UpsertServiceMethodRecord,
  type UpsertServiceRecord,
} from "@/server/repositories/service-catalog";

type ServiceSeedInput = {
  slug: string;
  name: string;
  shortName?: string;
  category: ServiceCategory;
  description: string;
  bodySystem?: string | null;
  eventType?: string;
  sortOrder: number;
};

function service(input: ServiceSeedInput): UpsertServiceRecord {
  return {
    slug: input.slug,
    name: input.name,
    shortName: input.shortName ?? input.name,
    category: input.category,
    description: input.description,
    bodySystem: input.bodySystem ?? null,
    eventType: input.eventType ?? input.slug.replaceAll("-", "_"),
    active: true,
    sortOrder: input.sortOrder,
  };
}

/**
 * Stable service catalog required by PLAN.md Part 06. Catalog entries describe
 * record types only; whether and when they are recommended belongs to a
 * separately reviewed guideline rule.
 */
export const SERVICE_SEED_RECORDS = [
  service({
    slug: "colorectal-cancer-screening",
    name: "Colorectal cancer screening",
    shortName: "Colorectal screening",
    category: "cancer_screening",
    description:
      "Screening tests for colorectal cancer in people without a clinician-managed history.",
    bodySystem: "Digestive system",
    sortOrder: 100,
  }),
  service({
    slug: "breast-cancer-screening",
    name: "Breast cancer screening",
    shortName: "Breast screening",
    category: "cancer_screening",
    description: "Screening mammography and related screening history.",
    bodySystem: "Breast tissue",
    sortOrder: 110,
  }),
  service({
    slug: "cervical-cancer-screening",
    name: "Cervical cancer screening",
    shortName: "Cervical screening",
    category: "cancer_screening",
    description: "Cervical cytology and high-risk HPV screening records.",
    bodySystem: "Cervix",
    sortOrder: 120,
  }),
  service({
    slug: "prostate-cancer-discussion",
    name: "Prostate cancer screening discussion",
    shortName: "Prostate discussion",
    category: "cancer_screening",
    description: "A shared decision about the potential benefits and harms of PSA-based screening.",
    bodySystem: "Prostate",
    sortOrder: 130,
  }),
  service({
    slug: "lung-cancer-screening",
    name: "Lung cancer screening",
    shortName: "Lung screening",
    category: "cancer_screening",
    description:
      "Low-dose CT screening history for people who meet reviewed tobacco exposure criteria.",
    bodySystem: "Lungs",
    sortOrder: 140,
  }),
  service({
    slug: "skin-health-review",
    name: "Skin health review",
    category: "cancer_screening",
    description:
      "A risk or concern-based skin health discussion without a universal screening cadence.",
    bodySystem: "Skin",
    sortOrder: 150,
  }),

  service({
    slug: "blood-pressure-screening",
    name: "Blood pressure screening",
    shortName: "Blood pressure",
    category: "cardiometabolic",
    description: "Clinical blood pressure screening and confirmation history.",
    bodySystem: "Cardiovascular",
    sortOrder: 200,
  }),
  service({
    slug: "prediabetes-type2-diabetes-screening",
    name: "Prediabetes and type 2 diabetes screening",
    shortName: "Diabetes screening",
    category: "cardiometabolic",
    description: "Blood-based screening for prediabetes or type 2 diabetes.",
    bodySystem: "Metabolic",
    sortOrder: 210,
  }),
  service({
    slug: "lipid-cardiovascular-risk-review",
    name: "Lipid and cardiovascular risk review",
    shortName: "Cardiovascular risk",
    category: "cardiometabolic",
    description: "A primary-prevention cardiovascular risk review that may use lipid results.",
    bodySystem: "Cardiovascular",
    sortOrder: 220,
  }),
  service({
    slug: "weight-bmi-review",
    name: "Weight and BMI review",
    shortName: "Weight and BMI",
    category: "cardiometabolic",
    description: "A neutral review of recent height, weight, and derived BMI measurements.",
    bodySystem: "Metabolic",
    sortOrder: 230,
  }),
  service({
    slug: "tobacco-use-review",
    name: "Tobacco use review",
    category: "mental_behavioral",
    description: "A private tobacco-use assessment or clinician discussion.",
    sortOrder: 240,
  }),
  service({
    slug: "alcohol-use-review",
    name: "Alcohol use review",
    category: "mental_behavioral",
    description: "A private alcohol-use screening questionnaire or clinician discussion.",
    sortOrder: 250,
  }),
  service({
    slug: "physical-activity-review",
    name: "Physical activity review",
    category: "cardiometabolic",
    description: "A discussion of activity habits and cardiovascular prevention goals.",
    sortOrder: 260,
  }),
  service({
    slug: "nutrition-review",
    name: "Nutrition review",
    category: "cardiometabolic",
    description: "A discussion of eating patterns and cardiovascular prevention goals.",
    sortOrder: 270,
  }),

  service({
    slug: "osteoporosis-screening",
    name: "Osteoporosis screening",
    shortName: "Bone density screening",
    category: "bone_joint",
    description: "Bone density screening intended to help prevent fragility fractures.",
    bodySystem: "Bone",
    sortOrder: 300,
  }),
  service({
    slug: "abdominal-aortic-aneurysm-screening",
    name: "Abdominal aortic aneurysm screening",
    shortName: "AAA screening",
    category: "vascular",
    description:
      "One-time abdominal aortic aneurysm screening with ultrasonography when appropriate.",
    bodySystem: "Vascular",
    sortOrder: 310,
  }),
  service({
    slug: "hepatitis-c-screening",
    name: "Hepatitis C screening",
    shortName: "Hepatitis C",
    category: "infectious_disease",
    description: "Hepatitis C antibody screening and related testing history.",
    bodySystem: "Liver",
    sortOrder: 320,
  }),
  service({
    slug: "hiv-screening",
    name: "HIV screening",
    shortName: "HIV",
    category: "infectious_disease",
    description: "Private HIV screening history.",
    sortOrder: 330,
  }),
  service({
    slug: "hepatitis-b-screening",
    name: "Hepatitis B screening",
    shortName: "Hepatitis B",
    category: "infectious_disease",
    description: "Private hepatitis B screening and testing history.",
    bodySystem: "Liver",
    sortOrder: 340,
  }),
  service({
    slug: "sti-screening",
    name: "Sexually transmitted infection screening",
    shortName: "STI screening",
    category: "infectious_disease",
    description: "Private, consent-based STI screening history.",
    sortOrder: 350,
  }),

  service({
    slug: "depression-screening",
    name: "Depression screening",
    category: "mental_behavioral",
    description: "A screening questionnaire or clinician discussion; it is not a diagnosis.",
    sortOrder: 400,
  }),
  service({
    slug: "anxiety-screening",
    name: "Anxiety screening",
    category: "mental_behavioral",
    description: "A screening questionnaire or clinician discussion; it is not a diagnosis.",
    sortOrder: 410,
  }),
  service({
    slug: "intimate-partner-safety",
    name: "Relationship safety check-in",
    category: "mental_behavioral",
    description: "A sensitive, owner-private safety screening or clinician conversation.",
    sortOrder: 420,
  }),
  service({
    slug: "fall-risk-review",
    name: "Fall risk review",
    category: "bone_joint",
    description: "A review of fall risk and individualized prevention options.",
    sortOrder: 430,
  }),
  service({
    slug: "hearing-review",
    name: "Hearing screening review",
    category: "sensory_function",
    description: "A hearing concern or screening discussion without a universal federal cadence.",
    sortOrder: 440,
  }),
  service({
    slug: "vision-review",
    name: "Vision screening review",
    category: "sensory_function",
    description: "A vision concern or screening discussion without a universal federal cadence.",
    sortOrder: 450,
  }),
  service({
    slug: "cognitive-concern-review",
    name: "Cognitive concern review",
    category: "sensory_function",
    description:
      "A concern-based cognitive health discussion; screening does not establish a diagnosis.",
    sortOrder: 460,
  }),
  service({
    slug: "functional-status-review",
    name: "Functional status review",
    category: "sensory_function",
    description: "A personal or clinician-defined review of daily function and support needs.",
    sortOrder: 470,
  }),

  ...[
    ["influenza-vaccine", "Influenza vaccine", "Seasonal influenza vaccination history."],
    ["covid-vaccine", "COVID-19 vaccine", "COVID-19 vaccination history and clinician discussion."],
    [
      "tdap-td-vaccine",
      "Tdap or Td vaccine",
      "Tetanus, diphtheria, and pertussis vaccination history.",
    ],
    ["zoster-vaccine", "Zoster vaccine", "Recombinant zoster (shingles) vaccination history."],
    ["pneumococcal-vaccine", "Pneumococcal vaccine", "Pneumococcal vaccination history."],
    ["rsv-vaccine", "RSV vaccine", "Respiratory syncytial virus vaccination history."],
    ["hpv-vaccine", "HPV vaccine", "Human papillomavirus vaccination history."],
    ["hepatitis-a-vaccine", "Hepatitis A vaccine", "Hepatitis A vaccination history."],
    ["hepatitis-b-vaccine", "Hepatitis B vaccine", "Hepatitis B vaccination history."],
    ["mmr-vaccine", "MMR vaccine", "Measles, mumps, and rubella vaccination history."],
    ["varicella-vaccine", "Varicella vaccine", "Varicella vaccination history."],
  ].map(([slug, name, description], index) =>
    service({
      slug: slug as string,
      name: name as string,
      category: "immunization",
      description: description as string,
      eventType: `${(slug as string).replaceAll("-", "_")}_dose`,
      sortOrder: 500 + index * 10,
    }),
  ),

  ...[
    [
      "primary-care-check-in",
      "Primary care check-in",
      "An editable personal primary-care visit template.",
    ],
    ["dental-care", "Dental care", "An editable personal dental care template."],
    ["eye-exam", "Eye exam", "An editable personal eye care template."],
    ["hearing-care", "Hearing care", "An editable personal hearing care template."],
    ["skin-care", "Skin care", "An editable personal skin care template."],
    [
      "medication-reconciliation",
      "Medication reconciliation",
      "A review of active medicines and instructions.",
    ],
    [
      "advance-care-planning",
      "Advance care planning",
      "An optional personal planning discussion template.",
    ],
    [
      "fall-prevention-home-safety",
      "Fall prevention and home safety",
      "An editable personal fall-prevention template.",
    ],
    [
      "specialist-follow-up",
      "Specialist follow-up",
      "A clinician-directed specialist follow-up template.",
    ],
    ["prescription-renewal", "Prescription renewal", "A medication renewal planning template."],
    ["custom-lab-bundle", "Custom lab bundle", "A clinician-defined group of laboratory tests."],
  ].map(([slug, name, description], index) =>
    service({
      slug: slug as string,
      name: name as string,
      category:
        slug === "medication-reconciliation" || slug === "prescription-renewal"
          ? "medication_monitoring"
          : slug === "custom-lab-bundle"
            ? "custom"
            : "routine_maintenance",
      description: description as string,
      sortOrder: 700 + index * 10,
    }),
  ),

  ...[
    ["lipid-panel", "Lipid panel", "A lipid laboratory result."],
    ["hemoglobin-a1c", "Hemoglobin A1c", "A hemoglobin A1c laboratory result."],
    ["fasting-glucose", "Fasting glucose", "A fasting glucose laboratory result."],
    [
      "kidney-function-panel",
      "Kidney function panel",
      "A clinician-ordered kidney function result.",
    ],
    ["liver-function-panel", "Liver function panel", "A clinician-ordered liver function result."],
    [
      "complete-blood-count",
      "Complete blood count",
      "A clinician-ordered complete blood count result.",
    ],
    ["thyroid-testing", "Thyroid testing", "A clinician-ordered thyroid laboratory result."],
    ["vitamin-d-testing", "Vitamin D testing", "A clinician-ordered vitamin D result."],
    ["psa-test", "PSA test", "A prostate-specific antigen laboratory result."],
    ["custom-lab", "Custom laboratory test", "A user or clinician-defined laboratory result."],
  ].map(([slug, name, description], index) =>
    service({
      slug: slug as string,
      name: name as string,
      category: slug === "psa-test" ? "cancer_screening" : "custom",
      description: description as string,
      eventType: "laboratory_result",
      sortOrder: 850 + index * 10,
    }),
  ),
] satisfies readonly UpsertServiceRecord[];

export type CatalogMethodSeed = Omit<UpsertServiceMethodRecord, "serviceId"> & {
  serviceSlug: string;
};

type MethodInput = {
  serviceSlug: string;
  slug: string;
  name: string;
  description: string;
  metadataJson?: Prisma.InputJsonValue | null;
};

function method(input: MethodInput): CatalogMethodSeed {
  return { ...input, active: true, metadataJson: input.metadataJson ?? null };
}

const discussionServices = [
  "prostate-cancer-discussion",
  "skin-health-review",
  "lipid-cardiovascular-risk-review",
  "weight-bmi-review",
  "tobacco-use-review",
  "alcohol-use-review",
  "physical-activity-review",
  "nutrition-review",
  "hearing-review",
  "vision-review",
  "cognitive-concern-review",
  "functional-status-review",
] as const;

const questionnaireServices = [
  "alcohol-use-review",
  "depression-screening",
  "anxiety-screening",
  "intimate-partner-safety",
  "fall-risk-review",
] as const;

const labServices = [
  "lipid-panel",
  "hemoglobin-a1c",
  "fasting-glucose",
  "kidney-function-panel",
  "liver-function-panel",
  "complete-blood-count",
  "thyroid-testing",
  "vitamin-d-testing",
  "psa-test",
  "custom-lab",
] as const;

const vaccineServices = SERVICE_SEED_RECORDS.filter(
  (entry) => entry.category === "immunization",
).map((entry) => entry.slug);

export const SERVICE_METHOD_SEED_RECORDS = [
  method({
    serviceSlug: "colorectal-cancer-screening",
    slug: "colonoscopy",
    name: "Colonoscopy",
    description: "Colonoscopy screening.",
  }),
  method({
    serviceSlug: "colorectal-cancer-screening",
    slug: "fit",
    name: "Fecal immunochemical test (FIT)",
    description: "Stool-based FIT screening.",
  }),
  method({
    serviceSlug: "colorectal-cancer-screening",
    slug: "high-sensitivity-guaiac-fobt",
    name: "High-sensitivity guaiac FOBT",
    description: "High-sensitivity guaiac fecal occult blood testing.",
  }),
  method({
    serviceSlug: "colorectal-cancer-screening",
    slug: "stool-dna-fit",
    name: "Stool DNA-FIT",
    description: "Combined stool DNA and FIT screening.",
  }),
  method({
    serviceSlug: "colorectal-cancer-screening",
    slug: "flexible-sigmoidoscopy",
    name: "Flexible sigmoidoscopy",
    description: "Flexible sigmoidoscopy screening.",
  }),
  method({
    serviceSlug: "colorectal-cancer-screening",
    slug: "flexible-sigmoidoscopy-with-fit",
    name: "Flexible sigmoidoscopy with FIT",
    description: "Flexible sigmoidoscopy paired with annual FIT as a source-supported strategy.",
  }),
  method({
    serviceSlug: "colorectal-cancer-screening",
    slug: "ct-colonography",
    name: "CT colonography",
    description: "Computed tomographic colonography screening.",
  }),
  method({
    serviceSlug: "breast-cancer-screening",
    slug: "mammography",
    name: "Mammography",
    description: "Screening mammography.",
  }),
  method({
    serviceSlug: "cervical-cancer-screening",
    slug: "cervical-cytology",
    name: "Cervical cytology",
    description: "Cervical cytology (Pap test) alone.",
  }),
  method({
    serviceSlug: "cervical-cancer-screening",
    slug: "primary-high-risk-hpv",
    name: "Primary high-risk HPV testing",
    description: "Clinician-collected primary high-risk HPV testing.",
  }),
  method({
    serviceSlug: "cervical-cancer-screening",
    slug: "co-testing",
    name: "Co-testing",
    description: "High-risk HPV testing with cervical cytology.",
  }),
  method({
    serviceSlug: "cervical-cancer-screening",
    slug: "self-collected-high-risk-hpv",
    name: "Self-collected high-risk HPV testing",
    description:
      "An approved self-collected high-risk HPV test used under source-specific guidance.",
  }),
  method({
    serviceSlug: "prostate-cancer-discussion",
    slug: "psa",
    name: "PSA blood test",
    description: "A PSA blood test recorded after an informed decision.",
  }),
  method({
    serviceSlug: "lung-cancer-screening",
    slug: "low-dose-ct",
    name: "Low-dose CT",
    description: "Low-dose computed tomography of the chest.",
  }),
  method({
    serviceSlug: "blood-pressure-screening",
    slug: "clinical-measurement",
    name: "Clinical blood pressure measurement",
    description: "A blood pressure measurement in a clinical setting.",
  }),
  method({
    serviceSlug: "blood-pressure-screening",
    slug: "ambulatory-monitoring",
    name: "Ambulatory blood pressure monitoring",
    description: "Ambulatory confirmation outside the clinic.",
  }),
  method({
    serviceSlug: "blood-pressure-screening",
    slug: "home-measurement",
    name: "Home blood pressure measurement",
    description: "A home measurement record; it does not automatically replace clinical screening.",
  }),
  method({
    serviceSlug: "prediabetes-type2-diabetes-screening",
    slug: "hemoglobin-a1c",
    name: "Hemoglobin A1c",
    description: "Blood testing with hemoglobin A1c.",
  }),
  method({
    serviceSlug: "prediabetes-type2-diabetes-screening",
    slug: "fasting-plasma-glucose",
    name: "Fasting plasma glucose",
    description: "Blood testing with fasting plasma glucose.",
  }),
  method({
    serviceSlug: "prediabetes-type2-diabetes-screening",
    slug: "oral-glucose-tolerance",
    name: "Oral glucose tolerance test",
    description: "A 2-hour oral glucose tolerance test.",
  }),
  method({
    serviceSlug: "lipid-cardiovascular-risk-review",
    slug: "lipid-panel",
    name: "Lipid panel",
    description: "A lipid result used as one input to risk assessment.",
  }),
  method({
    serviceSlug: "osteoporosis-screening",
    slug: "dxa",
    name: "DXA",
    description: "Dual-energy X-ray absorptiometry bone density screening.",
  }),
  method({
    serviceSlug: "abdominal-aortic-aneurysm-screening",
    slug: "abdominal-ultrasound",
    name: "Abdominal ultrasound",
    description: "Abdominal ultrasonography for aortic aneurysm screening.",
  }),
  method({
    serviceSlug: "hepatitis-c-screening",
    slug: "blood-test",
    name: "Blood test",
    description: "Hepatitis C antibody testing with follow-up testing when indicated.",
  }),
  method({
    serviceSlug: "hiv-screening",
    slug: "blood-test",
    name: "Blood test",
    description: "A laboratory HIV screening test.",
  }),
  method({
    serviceSlug: "hepatitis-b-screening",
    slug: "triple-panel-blood-test",
    name: "Hepatitis B triple-panel blood test",
    description: "HBsAg, anti-HBs, and total anti-HBc screening.",
  }),
  method({
    serviceSlug: "sti-screening",
    slug: "chlamydia-gonorrhea-test",
    name: "Chlamydia and gonorrhea test",
    description: "Laboratory screening for chlamydia and gonorrhea.",
  }),
  method({
    serviceSlug: "sti-screening",
    slug: "syphilis-blood-test",
    name: "Syphilis blood test",
    description: "Laboratory screening for syphilis.",
  }),
  ...discussionServices.map((serviceSlug) =>
    method({
      serviceSlug,
      slug: "clinical-discussion",
      name: "Clinical discussion",
      description: "A documented clinician discussion.",
    }),
  ),
  ...questionnaireServices.map((serviceSlug) =>
    method({
      serviceSlug,
      slug: "questionnaire",
      name: "Questionnaire",
      description: "A documented screening questionnaire.",
    }),
  ),
  method({
    serviceSlug: "dental-care",
    slug: "dental-visit",
    name: "Dental visit",
    description: "A routine or problem-focused dental visit.",
  }),
  method({
    serviceSlug: "eye-exam",
    slug: "eye-exam",
    name: "Eye exam",
    description: "An eye examination.",
  }),
  ...labServices.map((serviceSlug) =>
    method({
      serviceSlug,
      slug: "blood-test",
      name: "Blood test",
      description: "A laboratory blood test result.",
    }),
  ),
  ...vaccineServices.map((serviceSlug) =>
    method({
      serviceSlug,
      slug: "dose-record",
      name: "Vaccine dose",
      description: "A product-unspecified vaccine dose record.",
    }),
  ),
  method({
    serviceSlug: "tdap-td-vaccine",
    slug: "tdap",
    name: "Tdap",
    description: "Tetanus, diphtheria, and acellular pertussis vaccine.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "tdap-td-vaccine",
    slug: "td",
    name: "Td",
    description: "Tetanus and diphtheria vaccine.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "zoster-vaccine",
    slug: "recombinant-zoster",
    name: "Recombinant zoster vaccine",
    description: "Recombinant zoster vaccine dose.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "pneumococcal-vaccine",
    slug: "pcv15",
    name: "PCV15",
    description: "15-valent pneumococcal conjugate vaccine.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "pneumococcal-vaccine",
    slug: "pcv20",
    name: "PCV20",
    description: "20-valent pneumococcal conjugate vaccine.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "pneumococcal-vaccine",
    slug: "pcv21",
    name: "PCV21",
    description: "21-valent pneumococcal conjugate vaccine.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "pneumococcal-vaccine",
    slug: "ppsv23",
    name: "PPSV23",
    description: "23-valent pneumococcal polysaccharide vaccine.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "hepatitis-b-vaccine",
    slug: "two-dose-hepb",
    name: "Two-dose hepatitis B series product",
    description: "A hepatitis B product with a two-dose adult series.",
    metadataJson: { productSpecific: true },
  }),
  method({
    serviceSlug: "hepatitis-b-vaccine",
    slug: "three-dose-hepb",
    name: "Three-dose hepatitis B series product",
    description: "A hepatitis B product with a three-dose adult series.",
    metadataJson: { productSpecific: true },
  }),
] satisfies readonly CatalogMethodSeed[];

export const SERVICE_BY_SLUG = new Map(SERVICE_SEED_RECORDS.map((entry) => [entry.slug, entry]));

export function serviceEventType(serviceSlug: string): string {
  const entry = SERVICE_BY_SLUG.get(serviceSlug);
  if (entry === undefined) throw new Error(`Unknown catalog service: ${serviceSlug}`);
  return entry.eventType;
}

export async function seedServiceCatalog(database: DatabaseClient): Promise<{
  services: number;
  methods: number;
}> {
  const repository = createServiceCatalogRepository(database);
  const serviceIds = new Map<string, string>();

  for (const serviceRecord of SERVICE_SEED_RECORDS) {
    const seeded = await repository.upsertService(serviceRecord);
    serviceIds.set(serviceRecord.slug, seeded.id);
  }

  for (const methodRecord of SERVICE_METHOD_SEED_RECORDS) {
    const serviceId = serviceIds.get(methodRecord.serviceSlug);
    if (serviceId === undefined) {
      throw new Error(`Cannot seed method for unknown service slug: ${methodRecord.serviceSlug}`);
    }
    await repository.upsertMethod({
      serviceId,
      slug: methodRecord.slug,
      name: methodRecord.name,
      description: methodRecord.description,
      active: methodRecord.active,
      metadataJson: methodRecord.metadataJson,
    });
  }

  return {
    services: SERVICE_SEED_RECORDS.length,
    methods: SERVICE_METHOD_SEED_RECORDS.length,
  };
}
