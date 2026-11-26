# Smart textiles, contactless/bed sensors and heart-failure-specific remote monitoring (status as of 26 Nov 2026)

Scope note: skin-worn patches, watches, ECG patches/Holters and cuffless BP wristbands are covered by other researchers. A few patch-type HF devices (ZOLL HFMS, Cardiosense CardioTag, Acorai) are mentioned here only because they are HF-specific and were named in the brief. FDA facts below come from openFDA 510(k)/PMA records pulled in this session (data last updated 16 Nov 2026) unless otherwise noted. No EUDAMED lookups were possible in this session, so CE/MDR status rests on manufacturer or literature statements.

## 1. Smart textiles / vests / garments: what exists, what they measure, which are CE marked / FDA cleared and still active

### Takeaway
Only a few textile ECG garments have clear, current regulatory status. In the US: Nanowear SimpleSense / SimpleSense-BP (four 510(k)s, most recently Dec 2023), Nuubo (two 510(k)s, most recently 2023) and the Hexoskin Medical System (510(k) Nov 2025). In the EU: Chronolife Keesense (CE class IIa under the old directive; MDR recertification of version 2 was "in progress" at the last public update, Nov 2023). The Italian firm Comftech is commercially active in Italian telemedicine projects, but its CE status could not be confirmed. Myant Skiin, BioSerenity Cardioskin, Sensoria and Wearable Sensing have no verifiable current cardiac clearance. The ZOLL LifeVest is a garment-based wearable defibrillator rather than a monitoring textile.

### Cited Findings
**Chronolife Keesense (France)**
- The product is a T-shirt with six continuous parameters: ECG, thoracic impedance, temperature, thoracic respiration, abdominal respiration and physical activity. Sensors and electronics are fully integrated and the shirt is machine-washable without removing electronics. — [Chronolife Keesense page](https://chronolife.net/products/keesense/)
- Data path: Bluetooth to the patient's smartphone app, then to a web interface. Partners can pull the data into their own platforms, and clinicians get alerts and dashboards "via one of our remote monitoring platform partners" (Chronolife does not run its own dashboard). The patient sees only step counts. — [Chronolife Keesense page](https://chronolife.net/products/keesense/)
- Regulatory: "Version 1 of this medical device is a regulated health product and is CE mark (in accordance with European Directive 92/43/EC [sic; presumably 93/42/EEC MDD])… Keesense version 2 is undergoing certification according to… (2017/745/EU). November 2023." The page was last modified 29 Feb 2024, so treat this as old information. — [Chronolife Keesense page](https://chronolife.net/products/keesense/)
- French Healthcare describes Keesense as "CE Class IIa" and says the company was "currently seeking FDA" certification (undated). A 2020 article said Chronolife expected FDA clearance "by the year 2021". — [French Healthcare](https://frenchhealthcare.com/digital-health/a-connected-medical-t-shirt-enables-patient-monitoring-in-real-time/); [Sleep World Magazine 2020](https://sleepworldmagazine.com/2020/08/07/t-shirt-to-monitor-sleep-apnea/)
- No 510(k) record under applicant "Chronolife" exists in openFDA (query run this session). — [openFDA 510(k) query](https://api.fda.gov/device/510k.json?search=applicant%3AChronolife&skip=0&limit=5)
- Conflicting note: a 2022 oncology protocol paper describes the Chronolife shirt as "CE marked for the consumer market". — [OncoSmartShirt protocol, PMC9577710](https://pmc.ncbi.nlm.nih.gov/articles/PMC9577710/)
- Pharma use: Servier partnered with Chronolife to test the shirt in chronic conditions. — [Pharmaceutical Manufacturer](https://pharmaceuticalmanufacturer.media/pharma-manufacturing-news/servier-teams-up-with-chronolife-to-test-smart-t-shirt-for-c/)
- HF use: Dr Laurent Sebbag (Head of HF and Transplantation, Louis Pradel Hospital, Lyon) is quoted endorsing it (manufacturer testimonial). — [Chronolife Keesense page](https://chronolife.net/products/keesense/)

**Nuubo (Spain; legal entity Smart Solutions Technologies SL)**
- FDA 510(k) K173461 "ECG recorder and Arrhythmia Detector", cleared 3 Aug 2018 (product code DSH). — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3ANuubo)
- FDA 510(k) K231620 "Nuubo Smart", cleared 1 Aug 2023 (product code DQK). — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3ANuubo)
- Nuubo positions itself as a mid/long-term ambulatory ECG with textile electrodes and no adhesives or cables. The Nuubo30 textile senses ECG for remote ECG monitoring. — [Nuubo](https://www.nuubo.com/en-us); [Emergo by UL case](https://www.emergobyul.com/resources/nuubo-nuubo-system)
- Evidence: a 2026 JMIR Cardio scoping review of smart-textile ECG cites a study in which a 2-week garment ECG (Nuubo) detected AF recurrence in 18% of patients, "significantly outperforming" 24-h Holter. — [JMIR Cardio 2026 scoping review](https://cardio.jmir.org/2026/1/e74261) / [PMC12954708](https://pmc.ncbi.nlm.nih.gov/articles/PMC12954708/)

**Hexoskin (Canada; Carré Technologies)**
- FDA 510(k) K243981 "Hexoskin Medical System (7100-00016)", cleared 18 Nov 2025 (product code DXH). — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3AHexoskin)
- Company: the clearance covers recording, storing and analysing ECG, respiratory and activity signals for long-term monitoring. A trade press note says it can now be deployed in regulated US clinical trials. — [Hexoskin blog](https://hexoskin.com/blogs/news/a-breakthrough-in-remote-care-hexoskin-medical-system-receives-fda-510k-clearance-for-long-term-ecg-and-respiratory-monitoring); [AZBio](https://www.azbio.org/hexoskin-medical-system-receives-fda-510k-clearance-for-long-term-ecg-and-respiratory-monitoring)

**Nanowear (USA): SimpleSense / SimpleSense-BP (cloth undergarment band)**
- FDA 510(k)s: SimplECG K161431 (30 Nov 2016), SimpleSENSE K201669 (6 Nov 2020), SimpleSENSE Platform K212160 (22 Sep 2021, Special 510(k)) and SimpleSense-BP with software application K232053 (8 Dec 2023, product code DXN, non-invasive BP). — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3ANanowear)
- Nanowear's 2016 clearance was described as the first FDA 510(k) for a cloth-based remote cardiac monitoring technology. — [Specialty Fabrics Review 2019](https://specialtyfabricsreview.com/2019/07/01/e-textiles-in-health-monitoring/)
- Validation: in a SimpleSense BP-estimation paper, test mean absolute difference was ±6.38 mmHg (SBP) and ±5.10 mmHg (DBP). — [Kumar et al. 2022, PubMed 35906364](https://pubmed.ncbi.nlm.nih.gov/35906364/)
- The SimpleSense-BP clearance was announced as "AI-enabled continuous blood pressure monitoring and hypertension diagnostic management" (Jan 2024). — [Cardiowell registry citing Business Wire/MedTech Dive](https://www.cardiowell.com/wearable-bp-registry); [MobiHealthNews](https://www.mobihealthnews.com/news/nanowear-scores-third-fda-clearance-connected-vest-remote-monitoring)

**Comftech (Italy)**
- The Howdy system combines a sensorised garment, a detachable electronics unit, a mobile app and a cloud dashboard. It captures single-lead ECG, heart rate, respiratory rate, body position and activity level, for hospital and home use. — [MTEC profile](https://mtec-sc.org/life-sciences/comftech-s-r-l); [Comftech](https://comftech.com/en/); [ROSIA-PCP supplier page](https://rosia-pcp.eu/supplier/comftech/)
- Italian deployment: Comftech is the monitoring system for the "Ultraspecialisti" telemedicine service ("HOWDY SENIOR": HR, real-time ECG, RR, body position). — [Comftech news](https://comftech.com/en/comftech-monitoring-system-for-telemedicine-services-of-ultraspecialisti/)
- The ROSIA page says "Howdy System, certified…" but the snippet was truncated, so the exact certification could not be confirmed. — [ROSIA-PCP](https://rosia-pcp.eu/supplier/comftech/)

**Myant Skiin (Canada)**
- Myant started a Skiin clinical trial with PACE at Southlake Regional Health Centre to validate textile capture of ECG (form factors up to 3-lead) and other biometrics. — [Myant](https://shop.myanthealth.com/blogs/education/myant-initiates-skiin-clinical-trial-with-pace-at-southlake-regional-health-centre-to-validate-the-use-of-textile-based-solutions-for-the-capture-of-ecg-and-other-biometrics-in-adults-and-elderly)
- Skiin smart underwear was introduced in 2018 for ECG, HRV, activity, sleep and temperature. — [Textile Tech Source 2019](https://textiletechsource.com/2019/04/08/e-textiles-in-health-monitoring/)
- No 510(k) under applicant "Myant" exists in openFDA (query this session). — [openFDA query](https://api.fda.gov/device/510k.json?search=applicant%3AVayyar+OR+applicant%3ABinah+OR+applicant%3AMyant&skip=0&limit=5)

**BioSerenity (France): Neuronaute / Cardioskin**
- BioSerenity's FDA 510(k) for its wearable EEG system (Neuronaute EEG / IceCap) is documented. No current information on the Cardioskin ECG garment was found. — [NeuroNews](https://neuronewsinternational.com/bioserenity-receives-fda-clearance-for-eeg-wearable-device-system/); [24x7](https://24x7mag.com/standards/fda-updates/clearances/fda-clears-bioserenity-eeg-wearable-device-system/)

**ZOLL LifeVest (garment-based wearable cardioverter-defibrillator)**
- ZOLL says LifeVest has been worn by more than one million patients at risk of sudden cardiac death. ZOLL runs an Italian-language country site, which indicates presence in Italy. — [ZOLL LifeVest HCP](https://cardiac.zoll.com/medical-professionals/lifevest); [ZOLL Cardiac (country selector incl. Italia)](https://cardiac.zoll.com/)

**Adjacent wearable (not a textile, listed for completeness)**
- Cardiosense CardioTag (chest-worn sensor): FDA 510(k) in July 2025 for non-invasive SCG, ECG and PPG plus HR, followed by an FDA authorisation for HF-monitoring software. — [MassDevice](https://www.massdevice.com/cardiosense-fda-clearance-wearable-ecg-sensor/); [Medical Economics](https://www.medicaleconomics.com/view/cardiosense-receives-fda-authorization-for-heart-failure-monitoring-software)

### Inferences
- For an Italian cardiologist, the textile options with verifiable EU medical status are Keesense (multiparameter, HF-relevant thoracic impedance and respiration, but MDR transition status unclear) and possibly Comftech and Nuubo (CE not verified here). The US-cleared garments (Nanowear, Hexoskin, Nuubo) may or may not carry CE under MDR. EUDAMED should be checked before procurement.
- Textiles mainly add comfort and longer wear time for multi-day ECG and respiration capture. None has a hard-outcome RCT in HF comparable to the implantable sensors.
- Nanowear's BP clearance makes it the only garment with an FDA-cleared cuffless BP claim. It overlaps with the cuffless-BP category covered elsewhere.

### Gaps
- CE/MDR certificates (notified body, class, date) for Nuubo, Hexoskin, Nanowear, Comftech and Keesense v2 could not be checked because EUDAMED was not accessible in this session.
- Whether Keesense v2 obtained MDR certification after Nov 2023, and whether Chronolife ever filed with the FDA: not found.
- BioSerenity Cardioskin's current commercial status: one aggregator listing ("Bankrupt, Merged, Sold…" list) came up, but the snippet did not confirm BioSerenity's status, so it is unverified.
- Sensoria and Wearable Sensing were not researched (time limits). Kardiofit was not found.
- No prices or reimbursement were found for any textile garment in Italy or the EU.
- Clinical outcome trials in HF for textile monitoring: none found.

## 2. Contactless / under-mattress / radar / camera (rPPG) vital-sign monitoring

### Takeaway
FDA-cleared contactless options are Dozee VS (under-mattress ballistocardiography, 510(k) Dec 2022), Xandar Kardian XK300 (UWB radar, HR and RR, 510(k) 2021), Withings Sleep Rx (under-mattress, sleep-breathing, 510(k) Sep 2024) and, most recently, NuraLogix's Anura Mobile Core SDK (camera-based HR/RR software, 510(k) June 2026). In the EU, the Withings Sleep Analyzer carries a CE (MDD) mark for sleep-apnoea detection. Somnofy is a validated radar sleep and respiration monitor but is not FDA-cleared. Vayyar Care is a fall-detection product with no medical claim. EarlySense technology now sits inside Hillrom/Baxter beds. Binah.ai has no 510(k). None of these devices has HF-outcome trial evidence.

### Cited Findings
**Dozee (India)**
- FDA 510(k) K221555 "Dozee VS", applicant Turtle Shell Technologies Pvt Ltd (Bengaluru), cleared 15 Dec 2022. Product code BZQ (breathing frequency monitor), 21 CFR 868.2375. — [openFDA](https://api.fda.gov/device/510k.json?search=k_number%3A%22K221555%22)
- Mechanism: a thin under-mattress sensor sheet uses ballistocardiography to capture micro-vibrations from heartbeat, breathing and movement. Data go to the cloud and appear on a centralised dashboard with trends, scores and alarms. — [Dozee US](https://dozee.us/blogs/how-dozee-works-contactless-vital-tracking/); [Dozee for hospitals](https://www.dozeehealth.ai/for-hospitals)
- A pilot clinical evaluation in hospital patients is registered as NCT05153460. — [ClinicalTrials.gov](https://clinicaltrials.gov/study/NCT05153460)

**EarlySense → Hillrom → Baxter**
- In Feb 2021 Hillrom acquired EarlySense's contact-free continuous monitoring technology, and the monitoring was embedded in the Centrella Smart+ bed. Hillrom is now part of Baxter. — [PRNewswire 2021](https://www.prnewswire.com/news-releases/hillrom-announces-acquisition-of-contact-free-continuous-monitoring-technology-from-earlysense-301218606.html); [Baxter support news](https://support.baxter.com/en/news-center/hillrom-announces-acquisition-of-contact-free-continuous-monitoring-technology-from-earlysense/); [Hillrom Centrella PDF 2021](https://www.hillrom.com/content/dam/hillrom-aem/us/en/marketing/products/contact-free-continuous-monitoring-powered-by-earlysense/documents/209151-EN-r4_Centrella-Bed_HR-RR_Presentation.pdf)
- A competitor (Ably, maker of LYNG) claims EarlySense the company went insolvent and was liquidated in late 2022 and no longer supports products. This is competitor marketing and should be treated with caution. — [Ably](https://ablymed.com/earlysense-alternative)

**Withings Sleep Analyzer / Sleep Rx (France)**
- The sleep-apnoea detection feature of the Withings Sleep Analyzer received CE marking under MDD 93/42/EEC. It is a pneumatic under-mattress mat, validated for moderate-severe sleep apnoea. — [Edouard et al. 2021, PMC8314651](https://pmc.ncbi.nlm.nih.gov/articles/PMC8314651/); [Withings EU](https://www.withings.com/en-eu/products/sleep-analyzer)
- US: FDA 510(k) K231667 "Withings Sleep Rx", cleared 6 Sep 2024. Product code MNR (ventilatory effort recorder, 21 CFR 868.2375). — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3AWithings)

**Somnofy (VitalThings, Norway)**
- An impulse-radio UWB radar bedside sleep monitor measuring presence, sleep and respiration. A validation study showed agreement for longitudinal respiratory rate, and the study notes "Somnofy is not a Food and [Drug Administration-cleared device]". — [JMIR Biomed Eng 2022 / PMC11041471](https://pmc.ncbi.nlm.nih.gov/articles/PMC11041471/); [VitalThings](https://vitalthings.com/en/products/somnofy/)

**Xandar Kardian XK300 (radar)**
- FDA 510(k) K202464 (2021), Class II, for measuring resting HR and RR in adults, including nursing homes and home healthcare. It uses UWB radar at very low power, wall- or ceiling-mounted, with a reading every few seconds. Variants: XK300 Essence (home) and XK300-H (bedside). — [Kardian Health](https://kardianhealth.com/); [FDA K202464](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K202464)
- Registered in Canada, Australia, Singapore and Thailand. The company newsroom does not mention a CE mark. — [Xandar Kardian newsroom](https://xkcorp.com/newsroom.html)

**Vayyar Care**
- Touchless RF fall detection, "fully FCC-approved", sold for falls, presence, mobility and time at rest. An independent index notes no FDA or medical-device claim. — [Vayyar](https://vayyar.com/care-docs/b2c/); [AI Health Index](https://aihealthindex.io/vendors/vayyar-care)

**Emerald (MIT spin-out, Dina Katabi)**
- A radio-wave sensor that infers gait, breathing and sleep through reflected signals. It is used mainly in drug development (Alzheimer's, Parkinson's, immune diseases, Rett syndrome). — [Rett Syndrome Research Trust](https://reverserett.org/news/press-releases/rett-syndrome-research-trust-awards-to-emerald/); [Emerald publications](https://emeraldinno.com/publications/)
- No 510(k) for Emerald Innovations was found in openFDA (the query returned only unrelated "Emerald" companies). — [openFDA query](https://api.fda.gov/device/510k.json?search=applicant%3AEmerald)

**Camera-based rPPG apps**
- NuraLogix "Anura Mobile Core SDK (M1)": FDA 510(k) K253650, cleared 11 June 2026, product code QME. QME is Class II, 21 CFR 870.2785: "software algorithms to analyze video signal and estimate pulse rate, heart rate, respiratory rate and/or breathing rates… not intended to independently direct therapy." — [openFDA K253650](https://api.fda.gov/device/510k.json?search=applicant%3ANuraLogix); [openFDA product code QME](https://api.fda.gov/device/classification.json?search=product_code%3AQME&limit=1)
- Binah.ai: no 510(k) found in openFDA. Company materials describe "software-based health and wellness monitoring", and a Jan 2026 post frames the company around the FDA's updated digital-health and wellness guidance. — [openFDA query](https://api.fda.gov/device/510k.json?search=applicant%3ABinah); [Binah.ai](https://www.binah.ai/); [Binah LinkedIn](https://www.linkedin.com/posts/binah-ai_number-1-software-based-health-and-wellness-activity-7419303641980792832-Lyp-)
- A wearable-BP registry states that "none of the phone-camera systems here is cleared by the FDA for blood pressure". — [Cardiowell registry](https://www.cardiowell.com/wearable-bp-registry)

### Inferences
- Contactless sensors measure HR, RR, movement and sleep-breathing. None measures congestion or filling pressures. In HF they can serve only as surrogate trend monitors (e.g. a rising nocturnal RR, which is also an input to HeartLogic and TriageHF). They have no outcome evidence.
- For an Italian practice, the EU-relevant medical options are Withings Sleep Analyzer (CE, apnoea, an HF comorbidity) and possibly Dozee, Somnofy or radar devices if CE marked (not verified). The US-cleared radar (XK300) shows no CE registration.
- The first QME-coded camera clearance in this search (NuraLogix, June 2026) marks a regulatory turn for rPPG. It covers HR/RR only, not BP or HF metrics.

### Gaps
- CE/MDR status of Dozee, Somnofy, Xandar Kardian, NuraLogix and Binah was not verified (no EUDAMED access).
- Whether EarlySense-based monitoring is still sold by Baxter in the EU or Italy in 2026 is unclear.
- Philips or other big-vendor radar products for vital signs were not researched.
- Prices: none found for any contactless device.

## 3. Heart-failure-specific remote monitoring: implantable PA-pressure sensors, device diagnostics (ICD/CRT), lung fluid, wearable HF/defibrillator systems, scales and novel non-invasive haemodynamics

### Takeaway
The strongest evidence sits with PA-pressure-guided management. CardioMEMS has RCTs (CHAMPION; MONITOR-HF, a 44% HFH reduction in a European health system), and the 2026 ESC HF Guidelines (28 Aug 2026) upgraded PA-pressure monitoring to **Class IIa, Level B** for NYHA III patients with an HF hospitalisation in the past 12 months. Non-invasive telemonitoring stays at **IIb**. Cordella (Edwards) is FDA-approved (June 2024) with 2-year single-arm data; its CE status was not confirmed. Device-based multisensor indices (HeartLogic, TriageHF) are well validated for prediction and have Italian real-world data, but their outcome-RCT evidence is limited. IN-TIME (Biotronik) remains the RCT with a mortality signal. Non-invasive HF tools (ReDS, ZOLL HFMS, Bodyport, Acorai) range from FDA-cleared with mid-size trials to investigational.

### Cited Findings
**Guidelines**
- **ESC 2026 HF Guidelines** (published 28 Aug 2026, EHJ doi 10.1093/eurheartj/ehag100), section 11.5 Telemonitoring:
  - "Remote haemodynamic monitoring of PA pressure should be considered in symptomatic patients with HF, NYHA class III, and an HFH in the past 12 months in order to reduce the risk of HFH": **IIa, B**.
  - "Non-invasive telemonitoring modalities may be considered… to reduce the risk of HFH": **IIb, B**.
  - The text notes that only PA-sensor-guided therapy has been studied in multiple RCTs with HFH benefit.
  - Sources: [ESC guideline page](https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/heart-failure/); [ESC 2026 guideline PDF copy, Rec. Table 25](https://www.eledrisi.com/uploads/1/3/5/9/135945067/heart_failure_esc_2026_.pdf); [ESC Pocket Guidelines index (Telemonitoring section)](https://www.escardio.org/guidelines/clinical-practice-guidelines/pocket-guidelines/heart-failure/)
- **ESC 2021 HF Guidelines** (now superseded):
  - Non-invasive home telemonitoring: IIb, B.
  - Wireless PA-pressure monitoring "may be considered in symptomatic patients…": IIb, B. The extracted PDF text adds "with HFrEF (LVEF ≤35%)", which may be an extraction artefact.
  - Sources: [2021 ESC HF Guidelines PDF](https://www.pascar.org/uploads/files/2021_ESC_Guidelines_for_HF.pdf); [Bayes-Genis et al. 2025 review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12502462/)

**Abbott CardioMEMS HF (PA-pressure sensor)**
- CHAMPION: 28% reduction in 6-month HF hospitalisation rates with PAP-guided management. — [Mace et al., Heart Fail Rev 2025, PMC12296964](https://pmc.ncbi.nlm.nih.gov/articles/PMC12296964/)
- MONITOR-HF (Lancet 2023, Netherlands, RCT, n=348, NYHA III with ≥1 HFH in the prior 12 months, any LVEF): 44% reduction in HF hospitalisations and a 7-point KCCQ improvement versus standard care. — [Abbott clinical evidence](https://www.cardiovascular.abbott/us/en/hcp/products/heart-failure/pulmonary-pressure-monitors/cardiomems/clinical-evidence.html); [Brugts et al., Lancet 2023](https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(23)00923-6/abstract); [MONITOR-HF design, PMC6940408](https://pmc.ncbi.nlm.nih.gov/articles/PMC6940408/); [Cardiac Rhythm News](https://cardiacrhythmnews.com/monitor-hf-trial-results/)
- A Lancet correspondence notes that the QoL improvement appeared after 3 months only in the CardioMEMS arm and then remained stable (critical commentary on an open-label design). — [Kikoïne et al., Lancet 2024](https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(23)02679-X/fulltext)
- European single-arm studies: MEMS-HF reported a 62% HFH reduction and improved QoL. COAST-HF (European and Australian, 2026) reported improved QoL. — [Abbott clinical evidence](https://www.cardiovascular.abbott/us/en/hcp/products/heart-failure/pulmonary-pressure-monitors/cardiomems/clinical-evidence.html)
- US coverage: on 13 Jan 2025 CMS issued NCD 20.36, which covers FDA-approved implantable PA-pressure sensors under Coverage with Evidence Development. — [CMS CED page](https://www.cms.gov/medicare/coverage/coverage-evidence-development/implantable-pulmonary-artery-pressure-sensors-heart-failure-management); [CMS NCD 20.36](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=378&ncdver=1)
- Indicative US cost (secondary source): Medicare device acquisition cost $17,750 per unit and average selling price $24,950. — [Rhythm360 guide](https://www.rhythm360.io/blog/cardiomems-device-cost)
- Italy:
  - Implants reported at Policlinico Umberto I (Rome) and Misericordia Grosseto ("first implant in Tuscany"), plus a paediatric use in Bergamo.
  - The Umberto I report says a bedside unit transmits PAP data to the centre.
  - Tuscany evaluated the technology in a regional HTA attachment (Decreto n. 6189 del 23-04-2019).
  - Sources: [Policlinico Umberto I](https://www.policlinicoumberto1.it/policlinico-umberto-i-impiantato-cardiomens-strumento-unico-per-il-monitoraggio-attivo-dei-pazienti-con-scompenso-cardiaco/); [TecnoMedicina, Grosseto](https://www.tecnomedicina.it/al-misericordia-di-grosseto-il-primo-impianto-in-toscana-di-cardiomems-per-il-monitoraggio-nei-pazienti-scompensati/); [L'Eco di Bergamo](https://www.ecodibergamo.it/stories/premium/la-salute/cardiologia-pediatrica-un-piccolo-sensore-per-monitorare-da-casa-la-pressione-p-o_3961329_11/); [Regione Toscana HTA allegato](https://www301.regione.toscana.it/bancadati/atti/Contenuto.xml?id=5214496&nomeFile=Decreto_n.6189_del_23-04-2019-Allegato-1)
  - Italian review: [Centro Lotta contro l'Infarto 2023](https://www.centrolottainfarto.com/allnews/il-monitoraggio-remoto-della-pressione-polmonare-nello-scompenso-cardiaco-cronico-evidenze-di-efficacia/)
- EU reimbursement example: Belgium has reimbursed part of HF telemonitoring in qualifying hospitals since 1 Jan 2025. — [Heart Failure Pathway (BE)](https://heartfailurepathway.com/en/news/telemonitoring-for-patients-with-heart-failure-is-reimbursed-from-01-01-2025-in-belgium/)

**Endotronix / Edwards Cordella PA Sensor System**
- FDA PMA P230040 approved 20 June 2024 (product code MOM, Class III). Indication: NYHA III HF patients at home on diuretics and GDMT, stable for 30 days on GDMT, to aid HF management with the goal of reducing HFH. — [openFDA PMA P230040](https://api.fda.gov/device/pma.json?search=pma_number%3AP230040); [FDA SSED P230040C](https://www.accessdata.fda.gov/cdrh_docs/pdf23/P230040C.pdf)
- Edwards announced the acquisition of Endotronix (alongside JenaValve) on 24 July 2024. One consultancy cites a value of more than $790M (secondary source). — [Edwards press release](https://www.edwards.com/newsroom/news/2024-07-24-edwards-lifesciences-expands-structural-heart-port); [EQT](https://eqtgroup.com/news/eqt-life-sciences-portfolio-company-endotronix-acquired-by-edwards-lifesciences); [Sprig Consulting](https://sprigconsulting.com/work/endotronix/)
- PROACTIVE-HF (single-arm IDE): freedom from device- or system-related complications 99.2%, freedom from sensor failure 99.8%, KCCQ +5 points, 6MWT +23 m. — [Endotronix clinical page](https://endotronix.com/clinical/)
- 2-year results (J Card Fail, Mar 2026): HF events or death 0.89 (95% CI 0.81–0.99) per patient over 24 months, driven by HFH. HFrEF 1.0 vs HFpEF 0.8 events per patient (p=0.048). Management relied on seated mPAP plus comprehensive vital signs and symptoms through a digital platform. — [Guichard et al., PubMed 41833749](https://pubmed.ncbi.nlm.nih.gov/41833749/)
- PROACTIVE-HF 2 (randomised, NYHA II–III) is ongoing (NCT05934487). A real-world effectiveness study started 7 Feb 2025 (NCT06783335). — [ClinicalTrials.gov NCT05934487](https://clinicaltrials.gov/study/NCT05934487); [NCT06783335](https://clinicaltrials.gov/study/NCT06783335)
- EU: in 2024 Endotronix said it had submitted a CE-mark dossier and expected a decision in 2025. The SIRONA 2 study was described as the "CE Mark clinical trial". In 2022 the Cordella system without the sensor was available in the EU and the sensor was not yet commercial. — [CIToday 2024](https://citoday.com/news/endotronix-cordella-pa-sensor-system-receives-fda-approval); [Fierce Biotech](https://www.fiercebiotech.com/medtech/endotronix-claims-fda-approval-heart-failure-sensor-implant); [CIToday 2022](https://citoday.com/news/endotronix-continues-proactive-hg-global-ide-trial-of-cordella-pulmonary-artery-pressure-sensor)

**FIRE1 Norm (IVC sensor, investigational)**
- System: a sensor implanted in the inferior vena cava to monitor fluid volume, plus a belt worn for a few minutes daily, implanted in a same-day cath-lab procedure. The company raised $120M to fund trials. — [Silicon Republic](https://www.siliconrepublic.com/start-ups/fire1-norm-heart-monitoring-medtech-funding); [Yahoo Finance](https://finance.yahoo.com/news/fire1-raises-120m-trial-heart-095900711.html); [FIRE1](https://fire1foundry.com/about/)
- FUTURE-HF2 updated outcomes were presented at THT in Feb 2025 (slides behind registration). Implants in the NORM-HF trial are being reported by sites (weak source: an Instagram post). — [TCTMD](https://www.tctmd.com/slide/future-hf2-updated-outcomes-fire1-sensor-hf-patients); [Instagram site post](https://www.instagram.com/p/DfphbICGCtZ/)

**Other implantables**
- V-LAP (Vectorious, left-atrial pressure): VECTOR-HF single-arm results look promising for WHF events, but with a high device-failure rate at 30 months. The device is described as very early in development. — [Mace et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12296964/)
- Historical comparison: Medtronic Chronicle in COMPASS-HF (n=277) did not significantly reduce HF events. — [Mace et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12296964/)

**Device-based diagnostics in ICD/CRT**
- Boston Scientific HeartLogic (multisensor index):
  - Italian real-world cohorts. Capucci et al. 2019: HFH rate 0.21 per patient-year, unexplained alerts 0.41 per patient-year, 12% of time in alert, median early warning 38 days before HFH. Santini et al. 2020: unexplained alerts 0.37 per patient-year, hospitalisations without alert 0.05 per patient-year. — [Boston Scientific real-world evidence table](https://www.bostonscientific.com/en-US/medical-specialties/electrophysiology/heartlogic-heart-failure-diagnostic/clinical-data/real-world-evidence.html); [Capucci et al., ESC HF 2019](https://onlinelibrary.wiley.com/doi/full/10.1002/ehf2.12394); [Santini et al. 2020, PubMed 32304098](https://pubmed.ncbi.nlm.nih.gov/32304098/)
  - MANAGE-HF phase I: alert-based management was safely integrated into HF care. A 2026 review describes the approach as safe and potentially beneficial; it is not a definitive outcome RCT. — [Hernandez et al. 2022, PubMed 35460884](https://pubmed.ncbi.nlm.nih.gov/35460884/); [Bekfani et al. 2026 review](https://www.sciencedirect.com/science/article/pii/S1071916426000977)
  - An Italian HeartLogic Registry exists, as described in Boston Scientific's EU newsletter. — [BSci HeartLogic Newsletter 3/2022](https://www.bostonscientific.com/en-EU/medical-specialties/heart-failure/heartlogic-heart-failure-diagnostic-hfc/newsletter/2022/3.html)
- Medtronic TriageHF (OptiVol-based risk status):
  - Inputs include thoracic impedance, HRV, nocturnal parameters and activity. — [REMOTI-HF design, PMC13447187](https://pmc.ncbi.nlm.nih.gov/articles/PMC13447187/)
  - Validation in a CRT remote-monitoring cohort. — [Cardoso et al., Innovations in CRM 2023](https://www.innovationsincrm.com/cardiac-rhythm-management/articles-2023/septembert/2098-validation-of-a-heart-failure-risk-score-in-a-cohort)
  - The TriageHF Plus real-world pathway was associated with fewer hospitalisations (EHJ 2022 abstract). The REM-HF RCT of remote monitoring was neutral. — [Taylor et al., AER 2023 review](https://www.aerjournal.com/articles/clinical-pathways-guided-remotely-monitoring-cardiac-device-data-future-device-heart?language_content_entity=en); [PMC10326671](https://pmc.ncbi.nlm.nih.gov/articles/PMC10326671/)
  - REMOTI-HF is an ongoing single-centre RCT using HeartLogic and TriageHF. — [NCT06422832](https://clinicaltrials.gov/study/NCT06422832)
- Biotronik Home Monitoring, IN-TIME (Lancet 2014; 664 randomised; NYHA II–III, EF ≤35%, ICD/CRT-D):
  - Worsened composite score 18.9% vs 27.2% (OR 0.63, p=0.013).
  - Deaths 10 (3.0%) vs 27 (8.2%), p=0.004.
  - Sources: [Hindricks et al., Lancet 2014 (PDF)](https://test.limedic.se/wp-content/uploads/2022/06/2014-IN-Time-Hindricks_Lancet_2014_384_58390.pdf); [Biotronik IN-TIME](https://www.biotronik.com/en-int/professionals/clinical-trials/in-time)

**Lung fluid: Sensible Medical ReDS (remote dielectric sensing)**
- FDA 510(k)s: K150095 "ReDS Wearable System" (6 Aug 2015) and K180479 "ReDS System" (28 Feb 2019), product code DSB. — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3ASensible)
- SMILE RCT: a substantial reduction in recurrent ADHF hospitalisations in recently discharged patients. Daily adherence was associated with a 58% lower readmission risk (trade press). — [Abraham et al., J Card Fail 2019](https://www.sciencedirect.com/science/article/pii/S1071916419316823); [HCPLive](https://www.hcplive.com/view/lung-fluid-monitoring-heart-failure-readmission-smile-trial)
- Meta-analysis: significantly lower odds of 3-month HF readmission. A pilot found about 48% of WHF admissions not adequately decongested at discharge. ReDS-SAFE HF trial: JACC HF 2024. — [Sattar et al. 2021, PMC8462919](https://pmc.ncbi.nlm.nih.gov/articles/PMC8462919/); [Mace et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12296964/); [Sensible Medical](https://sensible-medical.com/new-approach-to-pulmonary-congestion-assessment/)

**Wearable HF systems: ZOLL HFMS (µCor) and LifeVest**
- FDA 510(k) K172510 "µCor Heart Failure and Arrhythmia Management System", cleared 11 May 2018 (product code MHX). It is a patch-based radiofrequency sensor that measures thoracic fluid and is marketed as the ZOLL HFMS. — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3AZoll); [ZOLL HFMS](https://cardiac.zoll.com/medical-professionals/heart-failure-management-system); [ZOLL Piedmont case study](https://cardiac.zoll.com/hubfs/HFMS%20Case%20Study%20-%20Piedmont%20Heart%20Institute.pdf?hsLang=en)
- BMAD trial (JACC HF, Dec 2024; open-label, concurrent control; 245 control vs 249 intervention):
  - 38% relative risk reduction in HF readmissions at 90 days (absolute −7%, NNT 14.3), 29% at 1 year (THT 2025 abstract).
  - KCCQ-12 improved 12 points more than control (p=0.004).
  - Sources: [ZOLL BMAD outcomes](https://cardiac.zoll.com/medical-professionals/heart-failure-management-system/clinical-outcomes); [Boehmer et al., JACC HF 2024](https://www.jacc.org/doi/10.1016/j.jchf.2024.07.022); [review, PubMed 40205273](https://pubmed.ncbi.nlm.nih.gov/40205273/)
- LifeVest: more than 1M patients worn. ZOLL operates an Italian site. — [ZOLL LifeVest](https://cardiac.zoll.com/medical-professionals/lifevest)

**Scales and novel non-invasive haemodynamics**
- Bodyport Cardiac Scale: FDA 510(k) K211585, cleared 29 July 2022, product code DSB (impedance plethysmograph, Class II, 21 CFR 870.2770). — [openFDA](https://api.fda.gov/device/510k.json?search=applicant%3ABodyport); [openFDA DSB](https://api.fda.gov/device/classification.json?search=product_code%3ADSB&limit=1)
- Acorai Heart Monitor (Sweden):
  - Non-invasive SCG, PPG, ECG plus stereo PCG, estimating absolute PA and intracardiac pressures, cardiac output and EF. Holds FDA Breakthrough Device Designation.
  - Feasibility (n=281) showed r=0.75 vs right-heart catheterisation; an extended analysis (n=336) showed r≈0.81. The global CAPTURE-HF study finished enrolment on 29 Oct 2024 (NCT05835024).
  - Sources: [Mace et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12296964/); [CIToday](https://citoday.com/news/acorais-study-of-noninvasive-pressure-monitoring-device-in-heart-failure-begins-enrollment); [Acorai](https://acorai.com/)
- Sensydia CPS: FDA-cleared to estimate LVEF from acoustic and ECG sensors. VoluMetrix NIVAHF (wrist piezo) is investigational: r=0.92 vs PCWP in 106 patients. — [Mace et al. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12296964/)

### Inferences
- The upgrade to IIa in the 2026 ESC guidelines is the biggest change since 2021. It strengthens the case for regional reimbursement requests in Italy for CardioMEMS (and Cordella once CE marked), but only in the narrow NYHA III + recent-HFH population.
- Placement next to patches, in descending evidence: PA-pressure implants (RCT, guideline IIa), then ICD/CRT diagnostics (data come "for free" in patients who already have devices, with strong Italian real-world experience but mixed RCTs), then non-invasive HF tools (ReDS, HFMS: FDA-cleared, mid-size trials, IIb at most as "non-invasive telemonitoring"), then investigational devices (Acorai, FIRE1, V-LAP).
- ZOLL HFMS and Acorai are effectively HF-specific patches. The report writer should coordinate with the patch section to avoid double counting.

### Gaps
- CE/MDR status and Italian availability of Cordella (no confirmation that CE was granted in 2025–26), ZOLL HFMS, ReDS, Bodyport and Acorai were not verified.
- GUIDE-HF results (US RCT, COVID-affected primary endpoint) were not retrieved in this session. Only the CMS NCD outcome is sourced.
- ESC 2023 focused update: not checked for any telemonitoring changes (no recommendation change is believed, but unverified).
- MANAGE-HF phase II outcome results and the HeartLogic MultiSENSE validation numbers (sensitivity, unexplained alert rate) were not retrieved.
- Italian prices or DRG for CardioMEMS implants, LifeVest rental cost, ReDS cost and HFMS cost: none found. The only cost figure is US CardioMEMS (secondary source).
- Medtronic OptiVol standalone evidence (e.g. DOT-HF) was not retrieved.
- Bodyport clinical outcome data (e.g. SCALE-HF) were not retrieved.

## 4. Integration into remote-monitoring workflows (CareLink, Merlin.net, LATITUDE, Biotronik HM) and the Italian experience (registries, AIAC/ANMCO positions, reimbursement)

### Takeaway
ICD/CRT HF diagnostics are natively inside the vendor CIED platforms, which are already used routinely in Italy. PA-pressure sensors and ZOLL HFMS use their own transmitter-to-cloud chain. Textiles and contactless sensors generally feed third-party RPM platforms. In Italy, CIED remote monitoring has been reimbursed region by region (Marche, Piemonte, Toscana, PA Trento, Veneto), after more than ten years of AIAC advocacy backed by HTA. AIAC is now (Nov 2026) discussing remote-only follow-up, wearables and AI. A new national outpatient tariff decree took effect in Sept 2026, but whether it codes CIED remote monitoring was not verified.

### Cited Findings
**Platforms and data flow**
- Chronolife Keesense: data go to partner RPM platforms and are not shown on a proprietary clinician dashboard. — [Chronolife](https://chronolife.net/products/keesense/)
- Dozee: cloud processing with a centralised dashboard, trends and alarms. — [Dozee](https://dozee.us/blogs/how-dozee-works-contactless-vital-tracking/)
- Comftech Howdy: app plus cloud dashboard, integrated into the Ultraspecialisti telemedicine service. — [MTEC](https://mtec-sc.org/life-sciences/comftech-s-r-l); [Comftech](https://comftech.com/en/comftech-monitoring-system-for-telemedicine-services-of-ultraspecialisti/)
- Cordella: a digital platform combining seated PAP, vital signs and symptoms. — [PubMed 41833749](https://pubmed.ncbi.nlm.nih.gov/41833749/)
- ZOLL HFMS and LifeVest: data run through the ZOLL Patient Management Network (login portal linked from ZOLL's site). — [ZOLL HFMS outcomes page header](https://cardiac.zoll.com/medical-professionals/heart-failure-management-system/clinical-outcomes)
- CardioMEMS in Italy: a bedside unit transmits PAP readings to the implanting centre. — [Policlinico Umberto I](https://www.policlinicoumberto1.it/policlinico-umberto-i-impiantato-cardiomens-strumento-unico-per-il-monitoraggio-attivo-dei-pazienti-con-scompenso-cardiaco/)
- IN-TIME: Biotronik Home Monitoring was the transmission backbone; most IN-TIME events transmitted were data gaps longer than 3 days. — [Hindricks et al., Lancet 2014](https://test.limedic.se/wp-content/uploads/2022/06/2014-IN-Time-Hindricks_Lancet_2014_384_58390.pdf)
- HeartLogic and TriageHF run on implanted devices and need no additional hardware. — [REMOTI-HF design](https://pmc.ncbi.nlm.nih.gov/articles/PMC13447187/)

**Italy: AIAC positions, HTA and reimbursement**
- AIAC states that administrative recognition and reimbursement of CIED remote monitoring is "finally spreading in Italy" after more than ten years of AIAC advocacy, supported by HTA, with COVID-era telemedicine giving a "final push". AIAC publishes the regional deliberations of Marche, Piemonte, Toscana, the Provincia Autonoma di Trento and Veneto. — [AIAC, Monitoraggio Remoto](https://www.aiac.it/area-scientifica/impulso/digital-health-telemedicina/monitoraggio-remoto)
- AIAC/AIAC-linked documents:
  - HTA of CIED remote monitoring (Ricci et al.). — [AIAC HTA PDF 2013](https://www.aiac.it/allegati/import/2018/03/Ricci_AIAC_telecardiologia_HTA_finale-18.11.2013.pdf); [Giornale Italiano di Cardiologia HTA](https://www.giornaledicardiologia.it/archivio/1864/articoli/20366/)
  - The 2012 Consensus Document on technologies, indications, organisational models, responsibility and economics. — [Giornale di Aritmologia 2012](https://www.giornalediaritmologia.it/archivio/896/articoli/9903/)
- AIAC coverage of the 2023 international (HRS-led) consensus on managing CIED remote monitoring (June 2023), and a Nov 17, 2026 AIAC interview with Dr Luca Santini on "remote-only follow-up, wearables and AI". — [AIAC page listing](https://www.aiac.it/area-scientifica/impulso/digital-health-telemedicina/monitoraggio-remoto); [AIAC Santini interview](https://www.aiac.it/area-scientifica/impulso/digital-health-telemedicina/monitoraggio-remoto/follow-up-solo-da-remoto-indossabili-ia-intervista-luca-santini)
- Italian studies on the AIAC site: MORE-CARE (remote monitoring of CRT-D) and "RM-alone" follow-up safety. — [AIAC MORE-CARE](https://www.aiac.it/area-scientifica/impulso/digital-health-telemedicina/monitoraggio-remoto/lo-studio-more-care-sul-monitoraggio-remoto-dei-device); [AIAC RM-alone](https://www.aiac.it/area-scientifica/impulso/digital-health-telemedicina/monitoraggio-remoto/rm-alone-sicurezza-ed-efficacia-di-un-sistema-basato-sul-monitoraggio-remoto-in-pazienti-portatori-di-defibrillatori-automatici-impiantabili)
- An Italian nursing review reports 44% shorter time-to-intervention and 18% lower atrial-arrhythmia burden with remote monitoring (secondary summary). — [Infermiere Online 2023](https://www.infermiereonline.org/2023/10/05/il-monitoraggio-remoto-dei-dispositivi-impiantabili-stato-dellarte-e-sfide-future/)
- Italian HeartLogic experience: Capucci 2019 and Santini 2020 cohorts, and the Italian HeartLogic Registry. — [Capucci 2019](https://pubmed.ncbi.nlm.nih.gov/30632306/); [Santini 2020](https://pubmed.ncbi.nlm.nih.gov/32304098/); [BSci newsletter](https://www.bostonscientific.com/en-EU/medical-specialties/heart-failure/heartlogic-heart-failure-diagnostic-hfc/newsletter/2022/3.html)
- National tariffs: the Salute-MEF decree of 7 Aug 2026 updated national outpatient (specialistica ambulatoriale) tariffs, in force from 21 Sept 2026. — [Quotidiano Sanità](https://www.quotidianosanita.it/governo-e-parlamento/specialistica-ambulatoriale-e-protesica-da-oggi-scattano-le-nuove-tariffe-prime-visite-a-circa-26-euro-piu-risorse-per-dialisi-diagnostica-e-riabilitazione/); [MEFOP](https://www.mefop.it/news/normativa/nomenclatore-tariffario-vigore-decreto)

### Inferences
- For Italian HF patients who already have ICD/CRT, HeartLogic or TriageHF alerts in LATITUDE or CareLink are the lowest-friction HF remote-monitoring layer. Reimbursement depends on the region's CIED remote-monitoring deliberation, not on the HF algorithm itself.
- PA-pressure sensors add a separate, dedicated workflow (daily readings, nurse-led titration). Given the 2026 ESC IIa recommendation, Italian HF networks may push for regional coding.
- Textile and contactless devices will mostly flow through generic telemedicine platforms (e.g. the platforms of Italy's PNRR-funded telemedicine programme). Interoperability with CIED platforms is not documented.

### Gaps
- Not verified in this session:
  - Whether the national tariff of Sept 2026 (or the LEA nomenclatore that took effect Dec 2024/2025) includes a code for CIED remote monitoring or for telemonitoring of HF.
  - The current list of all Italian regions with remote-monitoring reimbursement (beyond the five AIAC lists).
  - Any ANMCO or SIC position statement on HF telemonitoring or PA sensors.
  - Explicit confirmation that CardioMEMS data integrate into Abbott Merlin.net, HeartLogic into LATITUDE, and TriageHF into CareLink. This reflects general knowledge but no primary source was retrieved this session.
- Italian registry data for CardioMEMS (number of implants, outcomes): none found.
- Italy's PNRR telemedicine platform: whether it integrates CIED or HF-sensor data was not researched.
