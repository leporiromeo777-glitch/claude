# Multiparametric clinical-grade wearables for cardiological remote patient monitoring (state as of Nov 2026)

Research notes, compiled 26 Nov 2026. Scope: all-in-one wearables (patch, wristband, armband, chest belt, in-ear, garment only when multiparametric) that measure several of these: continuous ECG, BP, SpO2, RR, temperature, motion/posture/falls. Single-parameter ECG patches/Holters, standalone cuffless BP, contactless sensors and implantables are out of scope.

Method note: FDA 510(k) summaries were read in full through a server-side scraper, because direct fetches to accessdata.fda.gov and massdevice.com were blocked in this session. Where only search snippets or press coverage were available, this is flagged. Vendor claims are labelled as such.

---

## Q1. Product-by-product catalogue: what is on the market, with specs and regulatory status

### Takeaway
About 25 relevant products or platforms were identified. Only a handful hold medical clearance for 4 or more of the 6 requested parameters in one device: Biobeat chest patch, LifeSignals UbiqVue 2A, Corsano CardioWatch 287-2, VitalConnect VitalPatch, Sibel ANNE One (2 sensors), Equivital eq02+ and, historically, Sotera ViSi Mobile. Every product's regulatory scope is narrower than its marketing. The most common gaps are ECG that is on-demand rather than continuous, BP that is spot-check, needs cuff calibration or comes from a third-party cuff, and cuffless BP that is CE-marked but not FDA-cleared.

### Cited Findings

#### A. Corsano CardioWatch 287-2 (Corsano Health B.V., Netherlands): wrist bracelet
- **FDA (latest):** K261367, decision 26 Jul 2026, Class II, 21 CFR 870.2300. Product codes MSX, DQA, BZG, BZQ, FLL, DRG, DXN, FRI, LEL. Predicate is Corsano's own K232548 — [FDA 510(k) summary K261367](https://www.accessdata.fda.gov/cdrh_docs/pdf26/K261367.pdf)
- **FDA-cleared indications:**
  - *Continuous* (adults >22 y): pulse rate, SpO2, skin temperature, movement, sleep.
  - *Intermittent* (bracelet): respiration rate.
  - *Intermittent/spot-check:* NIBP, spirometry and weight, all via **third-party product integration**. In the US, BP is not cuffless from the bracelet.
  - Source: [K261367](https://www.accessdata.fda.gov/cdrh_docs/pdf26/K261367.pdf)
- **FDA-cleared accuracy:** PR 3 bpm ARMS (25–250 bpm); SpO2 <2% ARMS (70–100%); RR ±3 rpm ARMS (4–60); skin temperature ±0.3 °C (34–42 °C); sleep/wake vs PSG accuracy 97.0%, sensitivity 98.3%, specificity 83.7% — [K261367](https://www.accessdata.fda.gov/cdrh_docs/pdf26/K261367.pdf)
- **FDA limitations:**
  - No ECG in the FDA indications.
  - "Not intended for use on acutely ill cardiac patients with the potential to develop life threatening arrhythmias."
  - Not for ICU or OR.
  - Not for SpO2 under high motion or low perfusion.
  - Visible and audible alerts for PR, SpO2, RR and axillary temperature limits.
  - Connectivity: BLE, mobile app, cloud and web platform.
  - Source: [K261367](https://www.accessdata.fda.gov/cdrh_docs/pdf26/K261367.pdf)
- **Earlier FDA clearance:** K232548 was announced 22 Mar 2024. Its indications included spot-check NIBP and stated the device is "not a substitute for an ECG monitor" — [Corsano press](https://corsano.com/?p=28091); [K232548](https://www.accessdata.fda.gov/cdrh_docs/pdf23/K232548.pdf). MobiHealthNews describes BP as "spot monitoring of NIBP" via integrated third-party devices — [MobiHealthNews](https://www.mobihealthnews.com/news/emea/patient-friendly-real-time-remote-monitoring-system-receives-fda-clearance)
- **EU:**
  - CE under EU MDR 2017/745, **Class IIa** per the product leaflet — [Corsano 287-2 leaflet (Jan 2024)](https://corsano.com/wp-content/uploads/2024/01/Corsano-287-2-Leaflet.pdf)
  - Notified Body 1912 (DARE!! Services B.V.) — [Corsano EU-MDR press release](https://persportaal.anp.nl/artikel/a8d6a05f-512e-428b-87c3-f10f6457c9e4/corsano-health-receives-eu-mdr-certification)
  - No source found stating Class IIb.
- **Vendor-claimed parameters (product page updated 30 Sep 2026):**
  - HR, RR, "core temperature", SpO2, **cuffless BP**, **ECG**, accelerometry/activity, PPG (green, red, IR) and GSR.
  - Cuffless NIBP algorithm developed since 2019 on arterial-line and ABPM data from more than 500 patients, "validated according to ISO 81060-2:2019".
  - "Device Hub" for hospital-to-home continuity; claims "EU CE MDR and FDA certified".
  - Source: [Corsano bracelet page](https://corsano.com/products/bracelet-2/)
- **Cuffless BP outside the US:** Corsano's own tables mark cuffless NIBP as **EU only**. The vendor reports bias within ±2 mmHg, <5 mmHg, and a 97-subject ISO 81060-2 investigation — [Corsano Vital Parameters](https://corsano.com/?p=6110); [Corsano BP page](https://corsano.com/?p=5923). This is vendor data, read from search snippets.
- **ECG:**
  - 1-lead and **on-demand, not continuous**: two dry electrodes on the case back and the metal frame as negative electrode; the user touches the frame with the other hand.
  - 256 Hz sampling; validated to EN-IEC 60601-2-47:2015; labelled for AF screening.
  - Source: [Corsano ECG page](https://corsano.com/?p=3538)
  - Mayo Clinic multicentre AF-recognition study vs 12-lead ECG or 24 h Holter, enrolling — [Mayo Clinic trial listing](https://www.mayo.edu/research/clinical-trials/cls-20597457)
- **Variant:** "287-2B" appears only as a firmware reference ("New firmware 5.46 (287-2B)") in the Corsano AF app listing. No hardware details were found — [App Store, Corsano AF](https://apps.apple.com/nl/app/corsano-af/id1559005164)

#### B. Biobeat chest monitor / patch BB-613WP and wrist monitor (Biobeat Technologies Ltd, Israel)
- **FDA clearances listed on Biobeat's site:** K190792, K181006, K212153, K222010, K241066, plus CE 2797. The site is now positioned as "FDA Cleared Cuffless 24-hour Ambulatory Blood Pressure Monitoring" with a "clear reimbursement pathway" — [bio-beat.com](https://www.bio-beat.com/)
- **K222010 (Biobeat Platform-2 / BB-613WP patch, 30 Dec 2022):**
  - **Spot-check** collection, home and healthcare, of SpO2, pulse rate, **blood pressure**, respiration rate (RRp), **stroke volume, cardiac output** and body temperature.
  - BP tracked via **pulse-wave transit time (PWTT)** after **calibration with an FDA-cleared oscillometric cuff**.
  - Accuracy: SpO2 ±2%, PR ±3%, BP ±5 mmHg, CO ±30%.
  - 120 h operation; BLE to gateway to cloud; **no alarms**; not for critical care.
  - **ECG is not in the FDA indications.**
  - Source: [FDA K222010 summary](https://www.accessdata.fda.gov/cdrh_docs/pdf22/K222010.pdf)
- **K241066 (BB-613-BPM, 14 Jan 2025, DXN):**
  - Chest-worn patch for NIBP with a reading every 15 min over 24 h; red/IR PPG reflectance with PWTT.
  - Requires calibration with an oscillometric cuff; not for critical care; summary notes no alarms.
  - Source: [FDA K241066](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K241066.pdf)
  - Predicate K190792 is the BB-613 WP wrist/skin-attached device for SpO2 and PR — [FDA K190792](https://www.accessdata.fda.gov/cdrh_docs/pdf19/K190792.pdf)
- **Hospital-at-home kit:** GUDID lists a "BB-613 H@H kit" — [AccessGUDID](https://accessgudid.nlm.nih.gov/devices/07290020154309)
- **CE:**
  - "Full CE mark" announced 4 May 2021 for the wrist and chest devices, tracking "15 cardiopulmonary vital signs".
  - The chest monitor is disposable and short-term and **adds a 1-lead ECG**; the wrist monitor is for long-term use.
  - The platform includes an AI-driven early warning score and cloud alerts.
  - Source: [PR Newswire UK](https://prnewswire.co.uk/news-releases/biobeat-s-ai-powered-remote-patient-monitoring-platform-receives-a-full-ce-mark-883148022.html)
  - The sources do not say whether this certificate was issued under the MDD or the MDR.
- **Stroke volume / cardiac output:** additional FDA clearances announced — [BioSpace](https://www.biospace.com/biobeat-remote-patient-monitoring-devices-and-platform-receive-additional-fda-clearances-for-stroke-volume-and-cardiac-output)
- **Corporate (2025–26):**
  - Series B of USD 50 M co-led by Ally Bridge, OrbiMed and Elevage, dated Dec 2025 by one profile — [Longevity.Technology](https://longevity.technology/news/50m-boost-secured-for-biobeats-wearable-blood-pressure-tech/)
  - 13 Jan 2026: Kestra Medical Technologies signed a strategic collaboration and **exclusive license/co-development** to integrate Biobeat's cuffless 24 h ABPM into the ASSURE wearable cardioverter-defibrillator ecosystem, with a USD 5 M equity investment — [Kestra release](https://kestramedical.gcs-web.com/news-releases/news-release-details/kestra-medical-technologies-announces-strategic-collaboration); [DAIC](https://www.dicardiology.com/content/kestra-medical-technologies-biobeat-technologies-collaborate)
  - No acquisition of Biobeat was found.

#### C. LifeSignals UbiqVue 2A Multiparameter System, UX2550 (LifeSignals Inc., Milpitas, CA, USA): single-use chest patch
- **FDA:** K242018, Class II; product codes DRG, MHX, FLL, DQA — [FDA K242018 summary](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242018.pdf)
  - Date conflict: the summary text gives the decision date as 12 Nov 2024, while one database snippet cites a letter dated 10 Oct 2024. The company announced it on 25 Nov 2024 — [Newswire press release](https://www.newswire.ca/news-releases/lifesignals-receives-fda-510-k-approval-for-ubiqvue-tm-2a-multiparameter-system-842982965.html)
- **Indications:** continuous collection of physiological data at **home** and in healthcare settings (hospital, clinics, LTC etc.), non-critical adults 18 y and over — [K242018](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242018.pdf)
- **Parameters (FDA):**
  - **2-channel ECG**, HR, R-R interval and HRV (SDNN, RMSSD, LF/HF etc.).
  - **SpO2**, pulse rate and PPG waveform.
  - **Respiration rate**, skin temperature and **body temperature**.
  - **Body posture** (10 classes, including upright, supine and reclining) and **body motion** (4 levels).
  - **BP optional via third-party device**; NEWS2 early warning score.
  - Source: [K242018](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242018.pdf)
- **Accuracy:** SpO2 ±3% (70–100%); RR ≤3 brpm MAE (clinical); body temperature bias −0.27 °C with limits of agreement 1.01 °C — [K242018](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242018.pdf)
- **Hardware and connectivity:**
  - Wear life 120 h on a primary Li-MnO2 battery (single-use).
  - BLE 5.2 and Wi-Fi 802.11b, via a single-patient relay app, a multi-patient relay (cloud or on-premise) or BLE gateways.
  - Alarms per IEC 60601-1-8; notifications by e-mail, SMS or WhatsApp.
  - Predicates: LifeSignals K202868 and Biobeat K212153 (for SpO2, PR and body temperature).
  - Source: [K242018](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242018.pdf)
- **SpO2 technology:** white-light spectral SpO2 licensed from BioIntelliSense; the company claims performance across skin tones — [Respiratory Therapy](https://respiratory-therapy.com/products-treatment/monitoring-treatment/patient-monitoring-products/fda-clears-single-use-chest-based-wearable-patient-monitoring/)
- **EU:** EU MDR certification dated 5 Dec 2024, allowing CE marking — [Notebookcheck](https://www.notebookcheck.net/LifeSignals-UbiqVue-2A-biosensor-gains-EU-certification.932561.0.html)
- **Predecessors:** the LX1550 platform measured ECG, HR, RR, skin temperature and posture for up to 5 days — [MobiHealthNews](https://www.mobihealthnews.com/news/lifesignals-lands-fda-clearance-its-remote-monitoring-wearable-biosensor). LP1250 is an ECG-only patch.

#### D. VitalConnect VitalPatch / VitalPatch RTM (Vital Connect Inc., USA; iRhythm subsidiary since Oct 2026): chest patch
- **Parameters across the FDA records:**
  - Single-lead ECG, HR, HRV, R-R interval and respiratory rate.
  - Skin and body temperature.
  - Posture with **fall detection** (binary) and activity/steps.
  - Sources: [K183078](https://www.accessdata.fda.gov/cdrh_docs/pdf18/K183078.pdf); [K242129](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242129.pdf)
- **No SpO2 and no BP on the patch.**
- **Wear time:**
  - 96 to 120 h (K163453) — [FDA K163453](https://www.accessdata.fda.gov/cdrh_docs/pdf16/K163453.pdf)
  - 168 h, 7 days (K190916, 7 Jun 2019) — [Innolitics K190916](https://fda.innolitics.com/device/K190916)
  - K192757 for the 5D and 7D biosensors (6 Feb 2020) — [Innolitics K192757](https://510k.innolitics.com/device/K192757)
- **COVID-era EUA letter:** "not intended for use as a stand-alone diagnostic monitor for detection of changes in vital signs" — [FDA EUA letter](https://fda.gov/media/137398/download)
- **VitalPatch RTM:** listed in GUDID — [AccessGUDID](https://accessgudid.nlm.nih.gov/devices/00850490007450). Launched as an "extended Holter" for cardiac monitoring — [HMP EP Lab Digest](https://www.hmpgloballearningnetwork.com/site/eplab/vitalconnect-announces-launch-vitalpatchr-rtm-first-its-kind-extended-holter-technology-cardiac-monitoring)
- **VitalRhythm (K242129, 17 Apr 2025):** cloud arrhythmia analysis of VitalPatch single-lead ECG at **125 Hz**.
  - Detects AF/AFL, 2nd-degree AV block (types I and II), pause, PSVT, VT/run, sinus bradycardia and sinus tachycardia.
  - Results shown in the VistaCenter web app (Vista Solution platform), for outpatient cardiac telemetry in non-critical settings.
  - HR, ECG, HRV, R-R interval and RR are **not for patients with pacemakers**.
  - Source: [FDA K242129](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242129.pdf)

#### E. BioIntelliSense BioButton / BioSticker (BioIntelliSense Inc., USA)
- **FDA K241101 (BioButton System, 26 Sep 2024, DRG):**
  - Continuous collection, home and healthcare, **while the patient is at rest**, of HR, RR and skin temperature.
  - Also activity, body position, sleep, and step and gait analysis.
  - Not intended to output measurements during significant motion; not for critical care; adults 18 y and over.
  - Accuracy: HR <±5 bpm, RR <±3 brpm at rest, skin temperature per ASTM E1112.
  - Bluetooth to an MDDS gateway, then cloud; clinician-threshold notifications.
  - **No ECG and no SpO2.**
  - Predicate K212957; reference device BioSticker K191614.
  - Source: [FDA K241101](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K241101.pdf)
- **Product updates:** rechargeable multi-patient BioButton with BioDashboard cleared and announced in Oct 2024 — [BusinessWire](https://www.businesswire.com/news/home/20241002371306/en). IFU Ver. 5 dated May 2026 — [BioIntelliSense IFU](https://www.biointellisense.com/wp-content/uploads/2026/05/IFU-BBM-10045-Ver.5.pdf)
- **Sales model:** B2B only — [Notebookcheck](https://www.notebookcheck.net/BioIntelliSense-launches-BioButton-Rechargeable-wearable-that-can-measure-over-20-vital-signs.611247.0.html). The same article says the original BioButton was disposable "after 90 days", which was not verified against the IFU.
- **US distribution:** Medtronic holds exclusive US hospital and 30-day hospital-to-home distribution (announced 31 Aug 2022), with "up to 1,440 vital sign measurements daily" — [Medtronic news](https://news.medtronic.com/Patient-Monitoring-business-at-Medtronic-partners-with-BioIntelliSense-for-exclusive-U-S-hospital-and-hospital-to-home-distribution-rights-of-the-BioButton-multi-parameter-wearable); [Medtronic product page](https://www.medtronic.com/en-us/healthcare-professionals/products/patient-monitoring/remote-patient-monitoring/intelligent-patient-monitors/biobutton-multi-parameter-wearable.html)

#### F. Philips wearable portfolio
- **Biosensor BX100:**
  - FDA K192875; launched May 2020 as a disposable chest patch measuring HR and RR every minute, CE marked — [Philips press 2020](https://www.usa.philips.com/a-w/about/news/archive/standard/news/press/2020/20200526-philips-launches-next-generation-wearable-biosensor-for-early-patient-deterioration-detection-including-clinical-surveillance-for-covid-19.html); [Innolitics K192875](https://fda.innolitics.com/device/K192875)
  - The Philips Kuwait page says "This product is no longer available" — [Philips KW](https://www.philips.com.kw/healthcare/product/HC989803203011/biosensor-bx100-wearable-remote-measurement-device). The Canadian page still lists it — [Philips CA](https://www.philips.ca/healthcare/product/HC989803203011/biosensor-bx100-wearable-remote-measurement-device)
- **Healthdot:**
  - Measures HR, RR, posture and activity, sent about every 5 min. CE under EU MDR, **Class IIa** — [Philips Healthdot datasheet](https://www.documents.philips.com/assets/20220616/d886e009fa074dfb9b36aeb6014b8067.pdf)
  - Home use relies on a LoRa network and is **available only in the Netherlands** — [Philips SE Healthdot](https://www.philips.se/healthcare/e/healthdot)
  - April 2024: **smartQare acquires Philips' Healthdot business**, combining it with its viQtor platform — [Philips press 2024](https://www.philips.com/a-w/about/news/archive/standard/news/press/2024/philips-and-smartqare-partner-to-automate-and-simplify-continuous-patient-monitoring-in-and-out-of-the-hospital)
- **Masimo partnership:** Philips expanded its partnership with Masimo to pair the W1 watch with home patient monitoring — [MassDevice](https://www.massdevice.com/philips-masimo-expand-patient-monitoring-partnership-with-masimo-smart-watch/)

#### G. Masimo W1 medical watch (Masimo Corp., USA) and Freedom
- **FDA scope:** continuous SpO2 and pulse rate, OTC and Rx, adults in hospitals, clinics, LTC and home. K232512 is the original clearance; K240229 (Aug 2024) cleared Bluetooth connectivity to the Masimo SafetyNet telemonitoring app — [MassDevice](https://www.massdevice.com/fda-clears-masimo-w1-medical-watch-for-telemonitoring-connectivity/); [FDA K240229](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K240229.pdf); [FDA K232512](https://www.accessdata.fda.gov/cdrh_docs/pdf23/K232512.pdf); [Fierce Biotech](https://www.fiercebiotech.com/medtech/masimo-reels-fda-nod-pulse-oximetry-smartwatch-amid-apple-watch-patent-spats)
- **Freedom (successor):** reported with a CE mark and FDA clearance pending; adds ECG, falls and steps — [Fierce Biotech](https://www.fiercebiotech.com/medtech/masimo-deepens-consumer-wearable-war-new-privacy-minded-smartwatch)
- **Corporate:** Masimo has explored selling or separating its consumer audio and consumer health units; one report lists the Freedom watch inside a planned "Masimo Consumer" entity — [Zacks](https://zacks.com/stock/news/2323703/masimo-masi-gets-new-suitors-for-its-consumer-business-sale); [Audioholics](https://www.audioholics.com/does-masimo-consumer-spinoff-signal-future-sale). The W1's commercial status in 2026 was not confirmed.

#### H. Current Health (UK/US): upper-arm wearable plus peripherals
- **K191272 (2019):**
  - *Continuous:* PR, SpO2, temperature and movement.
  - *Intermittent/spot-check:* RR, BP and lung function, via peripherals.
  - Not for ICU or OR; not for SpO2 with high motion or low perfusion.
  - Source: [Innolitics K191272](https://fda.innolitics.com/device/K191272)
- **Later clearances:** K210133 (Sep 2021) — [Innolitics](https://fda.innolitics.com/device/K210133). K231506 (24 Aug 2023) lists RR as intermittent/spot-check — [FDA K231506](https://www.accessdata.fda.gov/cdrh_docs/pdf23/K231506.pdf). Becker's says RR is "continuous", which conflicts with the FDA label — [Becker's](https://www.beckershospitalreview.com/digital-health/fda-approves-ai-enabled-wearable-device-for-at-home-vital-sign-tracking/)
- **No ECG.**
- **Ownership:** Best Buy, which bought the company in 2021 for about USD 400 M, sold it back to co-founder Christopher McGhee (formerly McCann) in June 2025. Terms were undisclosed; Best Buy had booked a USD 475 M goodwill impairment on Best Buy Health in Q4 2024 — [Healthcare Dive](https://www.healthcaredive.com/news/best-buy-sells-current-health-home-care-christopher-mcghee/751645/); [TechTarget](https://www.techtarget.com/virtualhealthcare/news/366626734/Best-Buy-sells-Current-Health-back-to-former-CEO); [STAT](https://www.statnews.com/2025/06/26/after-best-buy-sale-whats-next-for-current-health-tech/)

#### I. Biofourmis Everion+ (Biovotion origin, Switzerland; Biofourmis Singapore/US): upper-arm band
- Everion+ System K213863 (wireless armband for continuous vital-sign monitoring) — [Innolitics K213863](https://fda.innolitics.com/device/K213863). Everion+ (G2) K233418 adds SpO2 (record dated 29 Mar 2024) — [Innolitics K233418](https://fda.innolitics.com/device/K233418)
- A device database still lists the adjustable armband "In Commercial Distribution" in the US, possibly outdated — [RevMed](https://revmedconnect.com/device/biofourmis-singapore-pte-ltd/evr-pd-aab/08885018690106)
- Biofourmis acquired Biovotion AG in 2019 — [MPO](https://www.mpo-mag.com/contents/view_breaking-news/2019-11-19/biofourmis-acquires-biovotion-ag/)
- CopilotIQ and Biofourmis merged in Oct 2024, combining consumer-facing and enterprise in-home care — [Fierce Healthcare](https://www.fiercehealthcare.com/health-tech/hlth24-copilotiq-biofourmis-merge-carve-out-bigger-slice-home-care-solutions-market); [HC Innovation Group](https://hcinnovationgroup.com/population-health-management/remote-patient-monitoring-rpm/news/55239595/remote-health-monitoring-companies-copilotiq-biofourmis-merge)

#### J. Isansys Lifecare Patient Status Engine and Lifetouch (UK)
- **PSE:** a wireless system for automatic, continuous real-time vital-signs monitoring, built on body-worn sensors — [NICE MIB271](https://www.nice.org.uk/advice/mib271/chapter/The-technology); [eeNews Europe](https://www.eenewseurope.com/en/patient-status-engine-combines-wireless-body-worn-sensors-with-cloud-based-electronic-health-record/)
- **Regulatory:** FDA K172329 (2018), including notification of out-of-range data — [Innolitics K172329](https://fda.innolitics.com/device/K172329). The company reports UKCA full QA and EU MDR certification, without dates — [Isansys press list](https://www.mynewsdesk.com/uk/isansys-lifecare-ltd/pressreleases)
- **Business model:** delivered "as a managed service" — [SBRI Healthcare](https://sbrihealthcare.co.uk/portfolio-item/isansys-life-ltd)
- **Deployments:**
  - Zollikerberg Hospital (CH), hospital-at-home — [Isansys news](https://mynewsdesk.com/uk/isansys-lifecare-ltd/news/isansys-patient-status-engine-platform-enables-a-ground-breaking-hospital-at-home-project-to-revolutionise-patient-care-472555)
  - Manipal Hospitals (India) — [Isansys news](https://www.mynewsdesk.com/uk/isansys-lifecare-ltd/news/indias-manipal-hospitals-partners-with-isansys-lifecare-to-launch-remote-patient-monitoring-technology-455613)
  - Recent NHS-capacity messaging — [Isansys press](https://isansys-lifecare-ltd.mynewsdesk.com/pressreleases/new-technology-offers-ethical-solution-to-nhs-overcrowding-and-ai-data-challenges-3364058)

#### K. Sensium (UK) SensiumVitals
- Measures HR, RR and skin temperature. A UK cost-utility analysis cited a patch cost of £150 and an estimated £350 per patient. No current regulatory or commercial status was found — [CADTH horizon scan 2023](https://www.cadth.ca/sites/default/files/pdf/htis/2023/EN0048-Vital-Signs-Monitoring-meta.pdf)

#### L. Sibel Health ANNE One (USA, Northwestern spinout): chest sensor plus limb (finger/wrist) sensor
- First FDA clearance announced 26 Oct 2021 (adults) — [PR Newswire](https://prnewswire.com/news-releases/sibel-health-announces-fda-clearance-for-anne-onea-flexible-wireless-vital-signs-monitoring-platform-301408901.html)
- May 2023: neonatal/infant clearance — [MobiHealthNews](https://mobihealthnews.com/node/153066)
- **ANNE Chest:** ECG waveforms, HR, RR, activity, **fall detection**, body position and skin temperature (12 y and over, home or hospital). **ANNE Limb:** SpO2, PR and skin temperature. Aug 2023 clearance covered the complete system; later clearances allow third-party software integration — [PR Newswire](https://prnewswire.com/news-releases/two-new-fda-clearances-for-sibel-health-enables-compatibility-of-advanced-wearable-sensors-to-3rd-party-software-solutions-302228024.html)
- No BP. No CE status was found.

#### M. Equivital eq02+ LifeMonitor (UK): chest belt
- Measures ECG, HR, breathing rate, skin temperature, activity, body position and fall detection. SpO2 requires a partner Nonin Xpod sensor.
- The datasheet claims CE **Class IIb**, FDA Class II and Health Canada Class II — [Equivital datasheet](https://equivital.com/wp-content/uploads/2021/07/EQ-000708-BR-3-eq02-LifeMonitor-Datasheet.pdf); [Equivital site](https://equivital.com/mobile-vital-signs-monitor)
- The FDA 510(k) found, K113054 (2012), covers the predecessor EQ02 — [Innolitics K113054](https://510k.innolitics.com/device/K113054)

#### N. Sotera Wireless ViSi Mobile (USA): wrist unit with chest ECG leads and thumb sensor (historical)
- Measures HR/PR, **3- or 5-lead ECG**, SpO2, **continuous cuffless BP (cNIBP)**, RR and skin temperature. Ambulatory, non-ICU hospital use.
- cNIBP is derived from pulse transit time chest to thumb, needs cuff calibration, and showed <5 mmHg bias vs arterial line.
- cNIBP cleared Oct 2013 — [News-Medical](https://www.news-medical.net/news/20131010/FDA-clears-Sotera-Wireless-patented-continuous-non-invasive-blood-pressure-technology.aspx); [MobiHealthNews](https://www.mobihealthnews.com/news/fda-clears-soteras-continuous-blood-pressure-monitor)
- No 2024–2026 information was found.

#### O. Caretaker Medical VitalStream (USA): wrist unit with low-pressure finger sensor
- Continuous beat-by-beat noninvasive BP and hemodynamics. FDA clearance in 2021; the April 2022 clearance added cardiac output, stroke volume, HRV and LVET — [MobiHealthNews](https://www.mobihealthnews.com/news/caretaker-medical-lands-fda-clearance-remote-blood-pressure-monitoring-system); [MassDevice](https://www.massdevice.com/fda-clears-caretaker-medicals-next-gen-noninvasive-blood-pressure-monitoring-platform/)
- Marketed mainly for ICU, OR and ER as an arterial-line alternative. Hospital-at-home use is mentioned, but a home-use indication was not confirmed — [Design News](https://www.designnews.com/medical/overcoming-the-blind-spots-in-hemodynamics-monitoring-beat-by-beat)

#### P. Nanowear SimpleSense / SimpleSense-BP (USA): textile undergarment, multiparametric
- **SimpleSense-BP** received FDA 510(k) in Jan 2024 as **SaMD**, using data from the garment: 2 ECG leads, heart sounds, thoracic impedance for respiration, and activity.
  - An initial cuff BP reading is needed to classify the patient.
  - The company states it tracks changes of more than ±15 mmHg systolic and ±10 mmHg diastolic.
  - Biobeat's wrist and chest monitor was cited as predicate.
  - The garment's first clearance was in Nov 2020.
  - Sources: [MedTech Dive](https://www.medtechdive.com/news/nanowear-fda-clearance-continuous-blood-pressure-monitor/703737/); [BusinessWire](https://www.businesswire.com/news/home/20240103951055/en/Nanowear-Announces-FDA-510-k-Clearance-for-AI-enabled-Continuous-Blood-Pressure-Monitoring-and-Hypertension-Diagnostic-Management-SimpleSense-BP)

#### Q. Hexoskin Medical System (Carré Technologies, Canada): smart shirt
- FDA K243981, decision 18 Nov 2025, Class II. Home or facility use on prescription; **3 ECG leads** plus respiratory and activity data. Not an apnea monitor; no automatic analysis — [Hexoskin press](https://hexoskin.com/blogs/news/a-breakthrough-in-remote-care-hexoskin-medical-system-receives-fda-510k-clearance-for-long-term-ecg-and-respiratory-monitoring); [Innolitics K243981](https://fda.innolitics.com/device/K243981)

#### R. Vivalink (USA/China)
- **Multi-vital ECG patch:** streams ECG, HR, RR and skin temperature, with local storage to cover network gaps.
- **Battery:** figures conflict. A Sept 2025 release says up to 2 weeks between charges; a 2024 piece says a 14-day rechargeable battery with 30-day storage; a spec page says 120 h — [HMP EP Lab Digest 2025](https://www.hmpgloballearningnetwork.com/site/eplab/news/vivalink-introduces-new-adhesive-wearable-ecg-enhance-ambulatory-cardiac-monitoring); [HIT Consultant 2024](https://hitconsultant.net/2024/05/08/vivalink-unveils-solution-for-streamlined-ambulatory-cardiac-monitoring); [MedicalExpo](https://www.medicalexpo.com/prod/vivalnk/product-121262-1061374.html)
- **Regulatory (2022):** FDA/NMPA for ECG and HR; CE for ECG, HR and RR. The BP patch was R&D-only — [DAIC 2022](https://www.dicardiology.com/content/vivalink-announces-worlds-first-multi-vital-blood-pressure-patch-remote-patient-monitoring)

#### S. cosinuss° c-med° alpha (cosinuss GmbH, Germany): in-ear sensor
- Continuous **core body temperature, HR and SpO2**; **EU MDR Class IIa**; BLE 5.0 — [cosinuss](https://www.cosinuss.com/en/products/in-ear-sensors/c-med-alpha); [App Store listing](https://apps.apple.com/my/app/c-med/id1627202336)
- Available as a medical device in DE, AT, GB and IE — [App Store listing](https://apps.apple.com/my/app/c-med/id1627202336)
- FDA K253436 (870.2300) for TEMP, SpO2 and PR, with temperature bias −0.06 °C and ARMS 0.31 °C vs esophageal reference — [Innolitics K253436](https://fda.innolitics.com/device/K253436)

#### T. Withings (France)
- **ScanWatch 2:** ECG app FDA-cleared (K240795, AF from single-lead ECG). Temperature tracking is explicitly "not a medical thermometer" — [Withings ScanWatch 2](https://www.withings.com/en-us/products/scanwatch-2-38w). FDA clearance of SpO2 on ScanWatch 2 is reported only by press — [Android Central](https://www.androidcentral.com/wearables/withings-scanwatch-2-and-scanwatch-light-launch)
- **BeamO:** a handheld, non-wearable spot-check "multiscope" combining ECG, digital stethoscope, thermometer and SpO2. FDA clearance (ECG for AF screening) with US launch on 13 Nov 2025 at about USD 249.95–250 — [Engadget](https://www.engadget.com/home/smart-home/withings-has-received-fda-clearance-for-medical-multiscopebeamo-110000186.html); [Withings press](https://insider.fitt.co/press-release/withings-redefines-at-home-family-healthcare-in-the-us-with-fda-clearance-of-beamo/)

#### U. Huawei Watch D2 / Watch D3 (Huawei, China): wrist with an inflatable micro-cuff in the strap
- **D2:** the ECG app, pulse-wave AF prompt, BP and **ambulatory BP monitoring** hold CE certification as medical devices under EU MDR 2017/745 — [Huawei UK D2](https://consumer.huawei.com/uk/wearables/watch-d2/). Also NMPA-approved — [Notebookcheck](https://www.notebookcheck.net/Huawei-Watch-D2-blood-pressure-smartwatch-makes-appearance-at-Medica-2024.923543.0.html)
- **D3:**
  - CE under MDR and registered in the Italian Ministry of Health medical-device database — [AGI, 8 Oct 2026](https://www.agi.it/innovazione/news/2026-10-08/huawei-watch-d3-smartwatch-pressione-salute-dispositivo-medico-39384768/); [Smartworld](https://www.smartworld.it/news/huawei-watch-d3-ufficiale.html)
  - BP is measured **oscillometrically** by an inflatable cuff in the strap, not optically — [Libero Tecnologia](https://www.libero.it/tecnologia/huawei-watch-d3-misurazione-pressione-come-funziona-smartwatch-prezzo-124455)
  - Five features are registered as medical devices in Italy, including ECG, AF detection and 24 h BP — [Il Sole 24 Ore](https://en.ilsole24ore.com/art/huawei-watch-d3-measures-blood-pressure-on-the-wrist-and-the-smartwatch-is-now-available-in-pharmacies-AJWv7HQB)
  - Pharmacy distribution through GammaDis Farmaceutici, targeting 500 pharmacies by 2027; list price **€449** — [Yourlifeupdated](https://www.yourlifeupdated.net/accessori/huawei-watch-d3-ufficiale-italia-pressione-prezzo)
  - Not waterproof — [Notebookcheck IT](https://www.notebookcheck.it/Recensione-dell-Huawei-Watch-D3-lo-smartwatch-con-monitoraggio-della-pressione-arteriosa-e-ora-ancora-migliore.1399991.0.html)

#### V. Consumer devices with specific medical clearances (reference only)
- **Apple Watch:** Hypertension Notification Feature FDA-cleared on 11 Sep 2025. It analyses optical heart sensor data over 30 days, alerts on patterns consistent with hypertension, is not diagnostic, and launched in more than 150 countries including the EU — [9to5Mac](https://9to5mac.com/2025/09/11/apple-watch-hypertension-alerts-feature-receives-fda-clearance/); [MobiHealthNews](https://www.mobihealthnews.com/news/apple-receives-fda-nod-hypertension-notification-feature)
- **Samsung:** no FDA BP clearance; European BP tracking on Galaxy Watch 8 requires cuff calibration — [Android Central](https://www.androidcentral.com/wearables/apple-watch-hypertension-alerts-just-put-every-smartwatch-rival-on-notice)
- **Movano EvieMED ring:** FDA 510(k) for its pulse oximeter on 2 Dec 2024, B2B for clinical trials and RPM — [MedTech Dive](https://www.medtechdive.com/news/movano-fda-smart-ring-pulse-oximeter/734407/); [MobiHealthNews](https://www.mobihealthnews.com/news/movano-health-secures-fda-clearance-eviemed-ring)

#### W. Other multiparametric devices found
- **Mezoo HiCardi+ H100 (Korea):**
  - FDA K232670 (20 Sep 2024) covers only single-lead ECG recording for 72 h — [FDA K232670](https://www.accessdata.fda.gov/cdrh_docs/pdf23/K232670.pdf)
  - Marketing claims respiration, skin temperature, activity, posture and 17 arrhythmia classes — [MEDTEC LIVE](https://medteclive.com/en/p/mezoo.137884)
  - No CE mark found for the patch.
- **Zephyr BioHarness (Zephyr Technology Corp., USA):**
  - K100040 (2010): HR, skin temperature, posture and activity, with breathing rate accurate only when sedentary; home, workplace and alternate care — [fda.report K100040](https://fda.report/PMN/K100040)
  - BioHarness 3.0: K113045 (2012) — [fda.report K113045](https://fda.report/PMN/K113045)
  - No recent activity found.
- **Byteflies (Belgium):**
  - The Kit (Model 1) conforms to the MDR — [Byteflies manual](https://manuals.plus/byteflies/docking-station-manual-3)
  - The Sensor Dot can acquire up to 6 synchronized physiological signals, but one US page labels it investigational — [Soterix Medical](https://soterixmedical.com/research/healthdot)
- **L.I.F.E. Italia MedDay (Milan, Italy):**
  - Wearable for multiparametric monitoring, polysomnography and Holter: **12-lead ECG**, SpO2, body temperature, respiratory-mechanics sensors and an IMU.
  - Local storage plus remote transmission.
  - Declared CE Class IIa under the **old MDD 93/42/EEC**, so MDR status needs verification.
  - Source: [Assolombarda technical sheet](https://www.assolombarda.it/desk/life-sciences-desk-backup/documenti/schedatecnica_medday_it)
- **G Medical Innovations (Israel):**
  - VSMS patch had a 2020 COVID-19 EUA for QT monitoring of hospitalized patients, with up to 14 days of wear — [FDA EUA doc](https://fda.gov/media/138108/download)
  - Prizma is a multi-sensor device — [CIO Review 2018](https://www.cioreview.com/g-medical-innovations-2018)
  - No 2025–26 status was found.

### Inferences
- **Patch-based multiparametric platforms** (Biobeat, LifeSignals, VitalPatch) are single-use 5–7 day sensors suited to post-discharge or hospital-at-home episodes, not long-term chronic monitoring.
- **Wrist and arm platforms** (Corsano, Current Health, Everion, Masimo W1, Huawei) are rechargeable and suited to longer monitoring, but lose continuous ECG.
- **US labels are systematically narrower than EU labels or marketing.** Corsano's cuffless BP and ECG are absent from FDA K261367. Biobeat's 1-lead ECG is in the CE scope but not in FDA K222010. Mezoo's RR and temperature are not in its FDA clearance.
- **Labels exclude high-risk arrhythmic patients.** Nearly all FDA labels say "not for critical care", and Corsano explicitly excludes "acutely ill cardiac patients with potential life-threatening arrhythmias". For a cardiologist, that means these devices complement rather than replace MCT, Holter or telemetry in high-risk arrhythmic patients.

### Gaps
- **Masimo Radius VSM / Radius PPG:** not researched in this pass. These are hospital-oriented tetherless monitors; no data collected.
- **Biotricity Bioflux and Bittium:** no 2024–26 data collected. These are mainly ECG and motion devices, so likely out of scope.
- **Prices:** no list prices or per-patient-per-month figures found for Corsano, Biobeat, LifeSignals, VitalPatch, BioButton, Current Health, Sibel, Equivital or Isansys. These are typically quoted B2B.
- **Missing specs:**
  - Exact battery life and sampling rates for several products (Corsano bracelet battery, Biobeat wrist device, Everion G2).
  - Isansys PSE sensor components (Lifetouch, Lifetemp, third-party SpO2 and BP) are not confirmed from primary sources in this pass.
  - Withings BPM Vision was not researched.
  - No information found on whether Oura holds any medical clearance; none was identified.

---

## Q2. Which products measure the most requested parameters in one device, and which are truly "all-in-one"?

### Takeaway
No single wearable available in late 2026 is cleared, in either the US or the EU, for **continuous** ECG, **continuous validated cuffless** BP, SpO2, RR, temperature and motion all at once in home use. The closest single-device options:
- **Biobeat chest patch (CE scope):** 1-lead ECG, cuffless BP, SpO2, RR, temperature, plus SV/CO. Its FDA scope is spot-check, needs cuff calibration, and excludes ECG.
- **LifeSignals UbiqVue 2A (FDA + CE MDR):** 2-channel ECG, SpO2, RR, skin and body temperature, posture and motion. BP comes only via a third-party cuff.
- **Corsano CardioWatch 287-2 (wrist):** SpO2, PR, RR, temperature and activity, with on-demand rather than continuous 1-lead ECG, and cuffless BP EU-only.

### Cited Findings
Parameter coverage, regulatory scope as cited in Q1. Key: C = continuous, S = spot-check/intermittent, 3P = via third-party device, OD = on-demand.

| Product (form) | ECG | BP | SpO2 | RR | Temp | Motion/posture/falls | Source |
|---|---|---|---|---|---|---|---|
| Biobeat BB-613WP chest patch | 1-lead (CE only) | Cuffless PWTT, cuff-calibrated; FDA spot/24 h ABPM | Yes | Yes (RRp) | Body temp | Not stated | [K222010](https://www.accessdata.fda.gov/cdrh_docs/pdf22/K222010.pdf); [K241066](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K241066.pdf); [CE 2021 PR](https://prnewswire.co.uk/news-releases/biobeat-s-ai-powered-remote-patient-monitoring-platform-receives-a-full-ce-mark-883148022.html) |
| LifeSignals UbiqVue 2A chest patch | 2-ch C | 3P | C | C | Skin + body | Posture (10 classes) + motion | [K242018](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242018.pdf) |
| Corsano CardioWatch 287-2 wrist | 1-lead OD, 256 Hz (CE) | Cuffless EU-only; FDA S via 3P | C | S (FDA) | Skin C | Movement, sleep | [K261367](https://www.accessdata.fda.gov/cdrh_docs/pdf26/K261367.pdf); [Corsano ECG](https://corsano.com/?p=3538); [Corsano Vital Parameters](https://corsano.com/?p=6110) |
| VitalConnect VitalPatch chest patch | 1-lead C, 125 Hz | No | No | C | Skin | Posture, falls, steps | [K242129](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242129.pdf) |
| Sibel ANNE One (chest + limb) | C (chest) | No | Limb | Chest | Skin | Activity, posture, falls | [PR Newswire](https://prnewswire.com/news-releases/two-new-fda-clearances-for-sibel-health-enables-compatibility-of-advanced-wearable-sensors-to-3rd-party-software-solutions-302228024.html) |
| Equivital eq02+ chest belt | C | No | Via Nonin add-on | C | Skin | Activity, position, falls | [Datasheet](https://equivital.com/wp-content/uploads/2021/07/EQ-000708-BR-3-eq02-LifeMonitor-Datasheet.pdf) |
| Sotera ViSi Mobile, hospital (2013 data) | 3/5-lead C | cNIBP (cuff-calibrated) | C | C | Skin | Not stated | [News-Medical](https://www.news-medical.net/news/20131010/FDA-clears-Sotera-Wireless-patented-continuous-non-invasive-blood-pressure-technology.aspx) |
| Current Health armband | No | S via 3P | C | S | C | Movement | [K191272](https://fda.innolitics.com/device/K191272) |
| BioIntelliSense BioButton | No | No | No | At rest | Skin | Activity, position, gait | [K241101](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K241101.pdf) |
| Nanowear SimpleSense(-BP) garment | 2-lead C | Cuffless SaMD (cuff for classification) | No | Thoracic impedance | Not stated | Activity | [MedTech Dive](https://www.medtechdive.com/news/nanowear-fda-clearance-continuous-blood-pressure-monitor/703737/) |
| Hexoskin shirt | 3-lead C | No | No | Yes | No | Activity | [Hexoskin](https://hexoskin.com/blogs/news/a-breakthrough-in-remote-care-hexoskin-medical-system-receives-fda-510k-clearance-for-long-term-ecg-and-respiratory-monitoring) |
| L.I.F.E. MedDay (Italy) | 12-lead | No | Yes | Respiratory mechanics | Body | IMU | [Assolombarda](https://www.assolombarda.it/desk/life-sciences-desk-backup/documenti/schedatecnica_medday_it) |
| Huawei Watch D2/D3 wrist | 1-lead OD (CE) | Oscillometric micro-cuff (CE), spot + ABPM | Not medically claimed | — | — | — | [Huawei UK](https://consumer.huawei.com/uk/wearables/watch-d2/); [Il Sole 24 Ore](https://en.ilsole24ore.com/art/huawei-watch-d3-measures-blood-pressure-on-the-wrist-and-the-smartwatch-is-now-available-in-pharmacies-AJWv7HQB) |
| cosinuss c-med alpha in-ear | No | No | C | No | Core C | No | [cosinuss](https://www.cosinuss.com/en/products/in-ear-sensors/c-med-alpha) |
| Masimo W1 wrist | No (Freedom: ECG) | No | C | — | — | — | [MassDevice](https://www.massdevice.com/fda-clears-masimo-w1-medical-watch-for-telemonitoring-connectivity/) |
| Philips Healthdot | No | No | No | Yes | No | Posture, activity | [Philips datasheet](https://www.documents.philips.com/assets/20220616/d886e009fa074dfb9b36aeb6014b8067.pdf) |
| Vivalink multi-vital patch | C | R&D only (2022) | Separate device | C | Skin | — | [DAIC 2022](https://www.dicardiology.com/content/vivalink-announces-worlds-first-multi-vital-blood-pressure-patch-remote-patient-monitoring) |

- Biobeat says its chest monitor adds 1-lead ECG to the wrist parameter set, and counts "15 cardiopulmonary vital signs" in the CE scope — [PR Newswire UK](https://prnewswire.co.uk/news-releases/biobeat-s-ai-powered-remote-patient-monitoring-platform-receives-a-full-ce-mark-883148022.html)
- LifeSignals counts 13 monitored parameters in addition to SpO2 — [MobiHealthNews / press coverage](https://www.mobihealthnews.com/news/lifesignals-lands-fda-clearance-its-remote-monitoring-wearable-biosensor)

### Inferences
- **"Truly all-in-one" by regulatory scope:**
  - *FDA:* **LifeSignals UbiqVue 2A** is the most complete single cleared patch (5 of 6 parameters, missing only BP).
  - *EU:* **Biobeat chest patch** has the broadest claimed scope, potentially 6 of 6 if motion is counted, but continuous BP rests on PWTT after cuff calibration, with accuracy concerns (see Q4).
- **Wrist all-in-one:** Corsano 287-2 is the most complete. It suits long-term monitoring of HF or post-discharge patients, but its ECG is a patient-initiated 1-lead strip, not continuous rhythm monitoring.
- **Two-device option:** for a cardiologist who needs continuous rhythm monitoring plus BP, the practical 2026 setup is a continuous-ECG multiparametric patch (LifeSignals, VitalPatch, Sibel) plus a validated cuff BP monitor or oscillometric ABPM, possibly a cuff-integrated wrist device such as Huawei D3. Most platforms already ingest third-party BP cuffs (LifeSignals, Corsano, Current Health).
- **Sotera ViSi Mobile** is a historical all-in-one, but it is hospital-only and has no current information.

### Gaps
- Whether Biobeat's chest patch reports posture, activity or falls was not confirmed.
- Whether Biobeat's ECG is continuous or intermittent was not confirmed.
- The Corsano 287-2B hardware differences were not found.
- No verified source on whether Biobeat's CE certificate is MDR- or MDD-era.

---

## Q3. Acquisitions, divestitures, discontinuations, recalls and FDA warning letters, 2024–2026

### Takeaway
2024–2026 brought significant consolidation:
- iRhythm acquired VitalConnect (closed 5 Oct 2026).
- Best Buy divested Current Health back to its founder (June 2025).
- CopilotIQ and Biofourmis merged (Oct 2024).
- smartQare acquired Philips Healthdot (April 2024).
- Kestra took an exclusive license and stake in Biobeat (Jan 2026).

Enforcement activity concentrated on consumer cuffless BP (Whoop warning letters 2025 and 2026) and on Philips' MCOT patch recall. No recalls or warning letters were found for the core multiparametric RPM wearables (Corsano, Biobeat, LifeSignals, BioButton, VitalPatch) in this search.

### Cited Findings
- **iRhythm / VitalConnect:**
  - Deal announced Aug 2026 — [Goodwin](https://www.goodwinlaw.com/en/news-and-events/news/2026/08/announcements-lifesciences-technology-goodwin-advises-vitalconnect-irhythm); [Cardiovascular Business](https://cardiovascularbusiness.com/topics/healthcare-management/healthcare-economics/irhythm-acquire-rival-cardiac-monitoring-company-288m)
  - **Closed 5 Oct 2026**; VitalConnect became an indirect wholly owned subsidiary — [SEC 8-K](https://www.sec.gov/Archives/edgar/data/0001388658/000138865826000083/irtc-20261005.htm); [closing press release](https://www.sec.gov/Archives/edgar/data/0001388658/000138865826000083/vitalconnect_closingprxf.htm)
  - Total USD 287.5 M (USD 237.5 M cash plus USD 50 M stock) — [iRhythm 10-Q Q3 2026](https://www.sec.gov/Archives/edgar/data/0001388658/000138865826000094/irtc-20260930.htm). Fierce reported USD 237.5 M "all-cash" — [Fierce Healthcare](https://www.fiercehealthcare.com/finance/irhythm-acquires-vitalconnect-2375m-all-cash-deal); the 10-Q is more complete.
  - iRhythm cites VitalConnect's "up to 30-day patient monitoring, four-in-one functionality, flexible service models and live look-in" — [Fierce Healthcare](https://www.fiercehealthcare.com/finance/irhythm-acquires-vitalconnect-2375m-all-cash-deal)
- **Current Health:** sold by Best Buy to co-founder Christopher McGhee in June 2025 — [Healthcare Dive](https://www.healthcaredive.com/news/best-buy-sells-current-health-home-care-christopher-mcghee/751645/)
- **CopilotIQ + Biofourmis:** merger announced Oct 2024, described as all-stock — [Fierce Healthcare](https://www.fiercehealthcare.com/health-tech/hlth24-copilotiq-biofourmis-merge-carve-out-bigger-slice-home-care-solutions-market); [DealStreetAsia](https://dealstreetasia.com/stories/biofourmis-copilotiq-416779)
- **Philips Healthdot:** acquired by smartQare (April 2024 announcement) — [Philips press](https://www.philips.com/a-w/about/news/archive/standard/news/press/2024/philips-and-smartqare-partner-to-automate-and-simplify-continuous-patient-monitoring-in-and-out-of-the-hospital)
- **Philips BX100:** marked "no longer available" on at least one regional Philips site — [Philips KW](https://www.philips.com.kw/healthcare/product/HC989803203011/biosensor-bx100-wearable-remote-measurement-device)
- **Biobeat / Kestra:** exclusive license, co-development and USD 5 M equity (13 Jan 2026) — [Kestra](https://kestramedical.gcs-web.com/news-releases/news-release-details/kestra-medical-technologies-announces-strategic-collaboration)
- **Philips MCOT recall:** Philips notified providers in Nov 2024 about the MCOT service and BTPS-1000 wearable patch; FDA later elevated the recall over unflagged ECG alerts, following 2 deaths — [Fierce Biotech](https://www.fiercebiotech.com/medtech/fda-elevates-philips-cardiac-telemetry-recall-over-unflagged-ecg-alerts-after-2-deaths). This is an ECG telemetry patch, not multiparametric, but part of Philips' remote cardiac portfolio.
- **Whoop warning letters:**
  - 14 Jul 2025 letter on "Blood Pressure Insights": BP estimation "not a low-risk function", outside the wellness policy — [FDA warning letter](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/whoop-inc-709755-07142025)
  - Follow-up letter dated 17 Jun 2026 references Whoop's changes to the product and labeling and the FDA's updated general wellness guidance — [FDA letter 2026](https://fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/whoop-inc-709755-06172026)
- **Other FDA consumer-device actions:**
  - FDA warned the public against unauthorized BP devices after clearing Apple's hypertension feature — [Fierce Biotech](https://www.fiercebiotech.com/medtech/following-apple-watchs-hypertension-clearance-fda-warns-public-against-using-unauthorized)
  - Sept 2025 safety communication against unauthorized infant vital-sign monitors — [FDA](https://fda.gov/medical-devices/safety-communications/do-not-use-unauthorized-infant-devices-monitoring-vital-signs-fda-safety-communication)
  - April 2025 recall of PyrAmes Boppli neonatal BP sensor band — [CDPH](https://www.cdph.ca.gov/Programs/CEH/DFDCS/CDPH%20Document%20Library/FDB/DeviceandDrugSafetyProgram/PyrAmesBoppliBedsideKitSensorRecall.pdf)
- **Masimo:** exploring the sale or spin-off of its consumer audio and consumer health units, possibly including the Freedom watch — [Zacks](https://zacks.com/stock/news/2323703/masimo-masi-gets-new-suitors-for-its-consumer-business-sale)

### Inferences
- **Consolidation is moving multiparametric RPM patches into cardiac-monitoring companies** (iRhythm–VitalConnect) and cardiac-device ecosystems (Kestra–Biobeat). Cardiologists will increasingly get these as bundled monitoring services rather than standalone devices.
- **Regulatory tightening on BP claims** (Whoop letters, updated wellness guidance) means only cleared or CE-certified BP functions should be relied on clinically.

### Gaps
- Whether Everion has been discontinued after the CopilotIQ merger was not found.
- Isansys corporate status in 2025–26 was not confirmed.
- Sensium's current trading and regulatory status was not found.
- The status of Sotera Wireless was not found.
- Masimo W1's 2026 commercial status was not confirmed.
- A systematic FDA recall database search (e.g., by product codes DRG, MSX, DQA) for 2024–26 was not possible in this session.

---

## Q4. Independent validation data, especially cuffless BP and wrist SpO2

### Takeaway
- **Wrist and chest SpO2** have reasonable validation evidence, mostly FDA/ISO ARMS testing and some independent studies: Corsano ARMS 1.28% during exercise; cosinuss in-ear ARMS 1.9%.
- **Cuffless BP evidence is weak and contested.** The only independent ICU study of Corsano's BP found poor agreement. Biobeat's formal ESH-protocol ABPM trial was still recruiting in 2026.
- **The 2026 ESC scientific statement** does not endorse cuffless devices for clinical decisions, consistent with ESH 2022/2023 and the AHA.

### Cited Findings
- **Corsano SpO2:**
  - Peer-reviewed study during high-intensity interval training vs Nellcor: ARMS 1.28% over 41,817 data points — [PMC11552347](https://pmc.ncbi.nlm.nih.gov/articles/PMC11552347)
  - Vendor-reported invasive comparison vs CO-oximetry SaO2 (N=300) — [Corsano Vital Parameters](https://corsano.com/?p=6110)
  - FDA label: SpO2 <2% ARMS (70–100%) — [K261367](https://www.accessdata.fda.gov/cdrh_docs/pdf26/K261367.pdf)
- **Corsano cuffless BP (independent):** ICU study of 19 patients vs invasive arterial line found low concordance, with bias 5.18 mmHg (DBP) and −11.27 mmHg (SBP); authors concluded the device is currently unsuitable for that purpose — [Frontiers in Digital Health 2025](https://www.frontiersin.org/articles/10.3389/fdgth.2025.1605020/full)
- **Corsano registered trials:**
  - MULTI-VITAL (NCT05566886, 65 catheterization patients) targeted SpO2 RMSE ≤3 and BP RMSE ≤10 mmHg; no published results were found — [protocol](https://cdn.clinicaltrials.gov/large-docs/86/NCT05566886/Prot_SAP_000.pdf)
  - COR-BP multicentre wrist BP vs cuff (NCT07633886) was "not yet recruiting" as of June 2026, with estimated primary completion Sept 2026 — [ClinicalTrials.gov](https://clinicaltrials.gov/study/NCT07633886)
- **Biobeat cuffless BP:**
  - Company-reported Scientific Reports study: 24 h bias −1.1 mmHg (SBP and DBP), daytime bias −1.9 mmHg — [HMP EP Lab Digest](https://www.hmpgloballearningnetwork.com/site/eplab/clinical-study-highlights-accuracy-biobeats-wearable-cuffless-blood-pressure-monitoring-device-when-compared-traditional-cuff-based-devices)
  - 2022 Frontiers study, co-authored with Biobeat staff, found similar agreement across sex, BMI and skin colour — [Frontiers in Physiology 2022](https://www.frontiersin.org/articles/10.3389/fphys.2022.911544/full)
  - Ongoing prospective multicentre trial vs 24 h cuff ABPM following the **2023 ESH cuffless validation protocol** (NCT07240831). Acceptance threshold: mean difference ≤5 mmHg and SD ≤8 mmHg. Recruiting as of 11 May 2026, estimated completion 30 Oct 2026 — [CenterWatch](https://www.centerwatch.com/clinical-trials/listings/NCT07240831/accuracy-of-a-cuffless-photoplethysmography-ppg-chest-patch-monitor-for-24-hour-ambulatory-blood-pressure-monitoring-abpm)
  - FDA K222010 accuracy claim: ±5 mmHg after cuff calibration — [K222010](https://www.accessdata.fda.gov/cdrh_docs/pdf22/K222010.pdf)
- **Sotera cNIBP:** bias <5 mmHg vs arterial line (2013 data, cuff-calibrated) — [News-Medical](https://www.news-medical.net/news/20131010/FDA-clears-Sotera-Wireless-patented-continuous-non-invasive-blood-pressure-technology.aspx)
- **Nanowear SimpleSense-BP:** tracks changes of more than ±15/±10 mmHg (company claim) — [MedTech Dive](https://www.medtechdive.com/news/nanowear-fda-clearance-continuous-blood-pressure-monitor/703737/)
- **cosinuss c-med alpha:** SpO2 ARMS 1.9% vs Rad-5 in healthy adults at rest — [TUM mediaTUM](https://mediatum.ub.tum.de/1751340). Temperature ARMS 0.31 °C vs esophageal — [Innolitics K253436](https://fda.innolitics.com/device/K253436)
- **LifeSignals:** SpO2 ±3% (70–100%); RR ≤3 brpm MAE; body temperature bias −0.27 °C — [K242018](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K242018.pdf)
- **Guidelines and position statements:**
  - ESH 2022 review: guidelines "do not recommend cuffless devices for the diagnosis and management of hypertension" — [ESH statement](https://researchers.mq.edu.au/en/publications/cuffless-blood-pressure-measuring-devices-review-and-statement-by/)
  - ESH 2023 validation recommendations for cuffless devices (tests depend on calibration, automatic vs manual, positions) — [PubMed 37303198](https://pubmed.ncbi.nlm.nih.gov/37303198/)
  - **ESC 2026 scientific statement** (ESC Working Group on e-Cardiology, Council on Hypertension, EAPC), *Eur J Prev Cardiol* 2026;33(7):1058–1071, DOI 10.1093/eurjpc/zwag058 (online March 2026). It does not endorse cuffless BP devices for clinical decisions, citing insufficient validation, and calls for dedicated validation protocols — [ESC365](https://esc365.escardio.org/journal/92047)
  - AHA scientific statement (undated in sources): cuffless devices should not currently be used to diagnose, track or treat hypertension — [EurekAlert](https://www.eurekalert.org/news-releases/1109402)
  - 2025 study of a consumer cuffless wearable vs ABPM found significant underestimation of nocturnal dipping and BP variability. This is a different device, not Biobeat or Corsano — [ESC365 EHJ-DH](https://esc365.escardio.org/journal/86521)

### Inferences
- **Clinical use of cuffless BP in 2026:** treat it as trend information only, re-calibrated against cuff readings. Use cuff-based ABPM or HBPM for diagnostic and therapeutic decisions.
- **Cuff-integrated wrist devices:** devices with a real oscillometric cuff in the strap (Huawei D2/D3) sit in a different evidence category from PPG/PWTT estimators, being closer to conventional validated BP devices.
- **SpO2 reliability:** wrist and chest SpO2 is reasonable at rest, but labels exclude high motion and low perfusion (Corsano, Current Health).

### Gaps
- No peer-reviewed independent validation of LifeSignals UbiqVue 2A SpO2 or of the Biobeat chest ECG was found.
- No independent validation for VitalPatch RR or temperature was found in this pass.
- Masimo W1 SpO2 validation publications were not retrieved.
- Huawei D2/D3 BP validation publications (e.g., ISO 81060-2 or ESH protocol studies) were not retrieved.
- Results of the Biobeat NCT07240831 and Corsano COR-BP trials were not yet available (expected late 2026).

---

## Q5. Availability in Italy/EU and business models

### Takeaway
- **CE-marked and broadly EU-available:** Corsano (MDR IIa), LifeSignals UbiqVue 2A (MDR, Dec 2024), Biobeat (CE since 2021), Equivital (IIb), cosinuss (MDR IIa) and Huawei Watch D2/D3.
- **Confirmed in Italy:** Huawei Watch D3 (registered in the Italian Ministry of Health database, sold in pharmacies at €449) and L.I.F.E. Italia MedDay (Italian manufacturer, MDD-era CE).
- **Business models** are mostly B2B or service-based (managed service, distribution partnerships, monitoring services). Public price lists are rare.

### Cited Findings
- **Corsano:** CE MDR Class IIa, Notified Body 1912 — [Corsano leaflet](https://corsano.com/wp-content/uploads/2024/01/Corsano-287-2-Leaflet.pdf); [ANP press](https://persportaal.anp.nl/artikel/a8d6a05f-512e-428b-87c3-f10f6457c9e4/corsano-health-receives-eu-mdr-certification)
- **LifeSignals:** EU MDR certified 5 Dec 2024 — [Notebookcheck](https://www.notebookcheck.net/LifeSignals-UbiqVue-2A-biosensor-gains-EU-certification.932561.0.html). Italian-language coverage also exists — [Notebookcheck IT](https://www.notebookcheck.it/Il-biosensore-UbiqVue-2A-di-LifeSignals-ottiene-la-certificazione-UE.932641.0.html)
- **Biobeat:** CE (2021), with Italian-language press release — [PR Newswire IT](https://www.prnewswire.com/it/comunicati-stampa/la-piattaforma-di-monitoraggio-remoto-dei-pazienti-con-intelligenza-artificiale-di-biobeat-riceve-la-marcatura-ce-completa-835107840.html)
- **cosinuss:** available as a medical device only in DE, AT, GB and IE — [App Store listing](https://apps.apple.com/my/app/c-med/id1627202336)
- **Philips Healthdot:** home use only in the Netherlands (LoRa) — [Philips SE](https://www.philips.se/healthcare/e/healthdot)
- **Huawei Watch D3 (Italy):**
  - Registered in the Ministry of Health database — [AGI](https://www.agi.it/innovazione/news/2026-10-08/huawei-watch-d3-smartwatch-pressione-salute-dispositivo-medico-39384768/)
  - Pharmacy channel through GammaDis, targeting 500 pharmacies by 2027 and more than 2,000 in the following two years; €449 — [Yourlifeupdated](https://www.yourlifeupdated.net/accessori/huawei-watch-d3-ufficiale-italia-pressione-prezzo); [Il Sole 24 Ore](https://en.ilsole24ore.com/art/huawei-watch-d3-measures-blood-pressure-on-the-wrist-and-the-smartwatch-is-now-available-in-pharmacies-AJWv7HQB)
- **L.I.F.E. Italia MedDay (Milan):** CE Class IIa under MDD 93/42 — [Assolombarda](https://www.assolombarda.it/desk/life-sciences-desk-backup/documenti/schedatecnica_medday_it)
- **Business models:**
  - Isansys PSE is delivered as a managed service — [SBRI Healthcare](https://sbrihealthcare.co.uk/portfolio-item/isansys-life-ltd)
  - BioButton is B2B only — [Notebookcheck](https://www.notebookcheck.net/BioIntelliSense-launches-BioButton-Rechargeable-wearable-that-can-measure-over-20-vital-signs.611247.0.html); US hospitals buy through Medtronic distribution — [Medtronic](https://news.medtronic.com/Patient-Monitoring-business-at-Medtronic-partners-with-BioIntelliSense-for-exclusive-U-S-hospital-and-hospital-to-home-distribution-rights-of-the-BioButton-multi-parameter-wearable)
  - Biobeat advertises a "clear reimbursement pathway" for cuffless 24 h ABPM (US) — [bio-beat.com](https://www.bio-beat.com/)
  - VitalConnect offers "flexible service models" — [Fierce Healthcare](https://www.fiercehealthcare.com/finance/irhythm-acquires-vitalconnect-2375m-all-cash-deal)
  - SensiumVitals: patch about £150, about £350 per patient (UK analysis) — [CADTH](https://www.cadth.ca/sites/default/files/pdf/htis/2023/EN0048-Vital-Signs-Monitoring-meta.pdf)
  - Withings BeamO retail about USD 250 — [Engadget](https://www.engadget.com/home/smart-home/withings-has-received-fda-clearance-for-medical-multiscopebeamo-110000186.html)

### Inferences
- **Italian procurement:** a cardiology centre in Italy would likely buy Corsano, LifeSignals or Biobeat through a distributor or tender as a service bundle (devices, platform and possibly monitoring centre). Huawei D3 is the only cuff-based wrist BP device with an established consumer and pharmacy channel in Italy.
- **US-only products:** VitalPatch, BioButton, Current Health, Sibel and Nanowear appear US-focused. No CE or Italian distribution evidence was found for them in this pass.

### Gaps
- No Italian distributor pages were found for Corsano, Biobeat, LifeSignals or VitalConnect.
- EUDAMED entries for any product could not be checked.
- No per-patient-per-month prices were found for any multiparametric platform.
- The Italian regulatory or reimbursement context (e.g., telemonitoring tariffs) was not researched here.
- No other Italian manufacturer of multiparametric wearables with MDR certification was identified. Note that smart textiles were excluded by scope.
