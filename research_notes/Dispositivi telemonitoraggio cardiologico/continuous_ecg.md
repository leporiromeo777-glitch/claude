# Continuous / Ambulatory ECG Remote Monitoring Devices for Cardiology (patch Holter, extended Holter, MCT, event recorders, ICM, clinical-grade personal ECG) — state as of November 2026

Scope note: ECG-centric devices only. Multiparametric all-in-one wearables, cuffless BP, smart textiles/contactless and HF hemodynamic implantables are covered by other researchers. Overlaps are mentioned only briefly (e.g. VitalPatch, Comftech). Research date: 26 Nov 2026. Items older than 2024 are flagged "(older)".

---

## 1. Product-by-product landscape: specs, service model, regulatory status, EU/Italy availability

### Takeaway
The market splits into: (a) **service-based US platforms**, where the device comes bundled with an IDTF/monitoring center and a report (iRhythm Zio, Boston Scientific BodyGuardian, Philips MCOT/ePatch, Baxter Bardy CAM, InfoBionic, Biotricity). (b) **"Sell-the-hardware + software" European platforms** that the hospital reads in-house (Bittium Faros/OmegaSnap, Cardioline, Philips ePatch + Cardiologs in EU, PocketECG as an algorithm/platform). (c) **ICMs** (Medtronic LINQ II, Abbott Assert-IQ, Boston Scientific LUX-Dx II+, Biotronik BIOMONITOR), with 3–6+ year batteries and cloud AI filtering. (d) **Patient-triggered handheld ECG** (AliveCor Kardia 6L/12L, HeartBeam). In Italy the realistic options are the hardware/software vendors (Cardioline, Bittium, Philips ePatch, PocketECG) and the ICMs. Zio is not officially marketed in Italy (its EU countries are AT, NL, ES, CH, UK).

### Cited Findings

#### 1a. Comparison table (patches / extended Holter / MCT)

| Product (maker, country) | Type | Channels | Max wear | Real-time vs post-wear | Extra sensors | Service / AI | Regulatory | Source |
|---|---|---|---|---|---|---|---|---|
| Zio monitor / Zio XT (iRhythm, USA) | Single-use patch, LTCM (long-term continuous monitoring) | 1-lead | 14 days (CEO: "in the future 21 days") | Post-wear (mail-back, AI + CCT report) | n/r | Deep-learned AI + certified cardiac technicians (Zio Service). Physicians agree with the reports "99% of the time" across >12M patients (company claim) | FDA 510(k). Latest Zio monitor 510(k) K243650 letter dated 15 Aug 2025. CE, UKCA, PMDA (Japan, MHLW approval Sept 2024) | [iRhythm Japan PR](https://investors.irhythmtech.com/news/news-details/2025/iRhythm-Launches-Zio-Long-Term-Continuous-Monitoring-Service-in-Japan-as-the-Zio-ECG-Recording-and-Analysis-System-Advancing-AI-Powered-Arrhythmia-Detection/default.aspx); [FDA K243650](https://www.accessdata.fda.gov/cdrh_docs/pdf24/K243650.pdf); [MDDI CEO interview Sep 2026](https://www.mddionline.com/wearable-medical-devices/irhythm-ceo-on-vitalconnect-acquisition-ai-powered-zio-patch-cyberattack-recovery); [iRhythm 10-K FY2025](https://www.sec.gov/Archives/edgar/data/1388658/000138865826000011/irtc-20251231.htm) |
| Zio AT (iRhythm) | Patch with wireless transmission of triggered/symptomatic events ("MCT-lite") | 1-lead | 14 days | Near-real-time transmission of events, plus a full-disclosure end-of-wear report | n/r | As above. CEO: Zio AT can address "about half" of the MCT market | FDA 510(k). Design modifications cleared Oct 2024 in response to the warning letter | [MedTechDive Nov 2024](https://www.medtechdive.com/news/FDA-iRhythm-second-510k-response-warning-letter/731769/); [MedTechDive Aug 2026](https://www.medtechdive.com/news/irhythm-grows-heart-monitoring-leadership-with-288m-vitalconnect-buy/827399/) |
| Zio MCT (iRhythm) | Next-gen MCT | n/r | n/r | Continuous MCT | n/r | — | **Not cleared.** Submitted Q3 2025. Company now says the FDA filing will come in 2027 (see Q5) | [MassDevice Oct 2025](https://www.massdevice.com/irhythm-submits-zio-mct-fda-q3-2025/); [Kirby McInerney/GlobeNewswire Nov 2026](https://www.globenewswire.com/news-release/2026/11/25/3410341/937/en/irhythm-holdings-inc-investigation-continues-investors-may-contact-kirby-mcinerney-llp-a-securities-fraud-law-firm-if-you-lost-money-on-your-irtc-investments.html) |
| VitalPatch / VitalConnect MCT (VitalConnect, USA; **acquired by iRhythm, closed 5 Oct 2026**) | Disposable multi-vital patch used for MCT | ECG (single-channel chest patch) | 120 or 168 h per patch. CEO says MCT up to 30 days (implies serial patches) | **Real-time streaming** via BLE (BT 4.1) to a relay | **Respiratory rate, body & skin temperature, posture, fall detection, step count/activity, HRV** | Arrhythmia classification (AF ≥15 s, SVT, 2nd-degree AVB, pauses, bigeminy/trigeminy, PR/QT/QTc/QRS). Labeled sensitivity/PPV ≥60–70%. Not valid in pacemaker patients | FDA cleared. CE Class IIa (per UK distributor) | [FDA VitalPatch IFU](https://www.fda.gov/media/137398/download); [MediBioSense](https://medibiosense.com/solutions/vitalpatch); [MDDI](https://www.mddionline.com/wearable-medical-devices/irhythm-ceo-on-vitalconnect-acquisition-ai-powered-zio-patch-cyberattack-recovery) |
| BodyGuardian MINI / MINI PLUS (Boston Scientific Cardiac Diagnostics, USA) | Reusable sensor + replaceable adhesives. One platform for MCT, "Connected Holter" and Holter | Single or multi (3 leads). 125–1000 Hz, 24-bit | MINI SL: up to 8 d Holter / 3 d MCT per charge. MINI EL: up to 16 d Holter / 7 d MCT. 4 GB = 30+ days of data | MINI PLUS: near-real-time transmission to the monitoring center. Holter mode: stored | n/r on spec sheet (no resp/temp listed) | BeatLogic AI + BSC Cardiac Monitoring Center. 24–48 h average report turnaround. "99% final report accuracy" (internal data, Aug 2025). EMR integration | FDA cleared (K-number not shown on page). Waterproof/submersible. SL 18 g, EL 22 g | [BSC HCP page](https://www.bostonscientific.com/us/en/healthcare-professionals/products/cardiac-monitors/bodyguardian-mini-remote-cardiac-monitors/fp90000213.html); [BSC MINI PLUS patient page](https://www.cdx.bostonscientific.com/us/en/patients/cardiac-monitor/bodyguardian-mini-plus.html) |
| Philips Extended Holter – ePatch (Philips, NL/DK origin) | Reusable rechargeable sensor + disposable patch, extended Holter | 1, 2 or 3 ch. 128–1024 Hz. 0.05–55 Hz bandwidth. 2 GB | Up to 14 days (default 2 ch @256 Hz) | **Post-wear, non-transmitting** | Event marker only | Cardiologs deep-learning AI. In the US: Philips monitoring service | FDA cleared. CE marked. Sensor life ≥300 uses or 2 years. **Not water-resistant with the patch (no bathing/swimming)**. Ages ≥18 | [ePatch IFU](https://www.documents.philips.com/assets/Instruction%20for%20Use/20240111/c50efb67fa6e458e875fb0f401565746.pdf?feed=ifu_docs_feed); [ePatch patient guide](https://www.myheartmonitor.com/wp-content/uploads/sites/2/2023/04/ePatch-Patch-PEG-220-0690-01-Rev-G-PAL-223903-4.18.23-1.pdf); [Philips UK](https://www.philips.co.uk/healthcare/product/960348/extended-holter-epatch-continuous-holter-recording-for-up-to) |
| Philips MCOT patch (BioTel/Philips, USA) | MCT | n/r | up to 30 d (CPT 93228/9 window) | **Real-time**: the sensor sends data via Bluetooth to a monitor, which transmits automatically | n/r | Philips IDTF (24/7 techs). Monitoring Service Application (MSA) software | FDA cleared. US service only. **Class I correction of the MSA software (Jan 2025)**, see Q5 | [myheartmonitor MCOT](https://www.myheartmonitor.com/device/mcot-patch/); [FDA correction notice](https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/outpatient-telemetry-correction-philips-issues-correction-monitoring-service-application-used-mobile) |
| Bardy CAM Patch (Baxter, USA; ex-Bardy Diagnostics/Hillrom) | Single-use extended-wear patch | 1-lead, P-wave-optimized (sternal placement) | up to 14 days | Post-wear | n/r | BardyDx ECG analysis services + reporting | FDA 510(k) K172234 (14-day version launched Jan 2020, older) | [Baxter CAM](https://pro.baxter.com/products/diagnostics-examination/cardiac-care-solutions/cam-patch); [BardyDx](https://www.bardydx.com/solutions/cam/); [FDA FOIA log citing K172234](https://www.fda.gov/media/187428/download); [PRNewswire](https://www.prnewswire.com/news/bardy-diagnostics%2C-inc./) |
| Bittium Faros 360 / 180 / 180L + OmegaSnap patch electrodes (Bittium, Finland) | Reusable recorder that snaps onto patch electrodes, or is used with cables | 360: 1–3 ch. 180/180L: 1 ch. Up to 1000 Hz (180L: 250 Hz) | Battery up to 7 d (180L: up to 14 d continuous). Memory up to 180 days | Mostly post-wear (micro-USB download, EDF format). Bluetooth Classic interface available | **3D accelerometer** (up to 100 Hz) | Bittium Cardiac Navigator analysis software (in-house reading) and MedicalSuite platform | CE (status/MDR class not stated in the brochure). IP67. Adult + pediatric. Italian-language OmegaSnap quick guide exists | [Inmed/Bittium brochure Jul 2026](https://inmed.com.au/wp-content/uploads/2026/09/Bittium-Cardiac-Monitors_JULY2026_WEB.pdf); [Bittium OmegaSnap IT guide](https://www.bittium.com/wp-content/uploads/2024/10/5800689A01_Bittium_OmegaSnap_3CH__Elettrodo-Guida-Rapida_IT.pdf) |
| PocketECG IV (Medicalgorithmics, Poland) | Smartphone-sized recorder + electrodes, MCT/Holter/event, "online" monitoring | n/r (historically 3-ch; not re-verified) | n/r | Real-time "online" transmission | n/r | Company now positions itself as an **"FDA-cleared AI algorithm" vendor** for third-party devices. New US partner deals in 2026 | FDA 510(k) K193104 (PocketECG IV). PocketECG CRS (cardiac rehab) cleared 2018 (older) | [FDA K193104](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm?ID=K193104); [Medicalgorithmics PocketECG](https://www.medicalgorithmics.com/reszta_produktow/pocketecg/); [Current report 47/2026](https://www.medicalgorithmics.com/current-reports/47-2026-conclusion-of-an-agreement-with-a-us-partner-providing-for-total-fees-of-at-least-pln-786-thousand-for-the-first-year-of-cooperation/); [DAIC 2018](https://www.dicardiology.com/product/fda-clears-pocketecg-crs-mobile-cardiac-rehabilitation-system) |
| Vivalink Cardiac Patch / VV330 (Vivalink, USA) | Reusable rechargeable patch, MCT + Holter + clinical trials | n/r | up to 14 days (rechargeable) | **Real-time live stream** | Multi-vital platform (temperature, BP integrations) | Platform/OEM model (sold to service providers and pharma) | FDA 510(k) K191870 (VV330 Continuous ECG Platform, Jan 2020, Class II, DRG, older) | [FDA K191870](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K191870); [Vivalink ECG](https://www.vivalink.com/wearable-ecg-monitor); [DAIC](https://www.dicardiology.com/content/vivalink-releases-14-day-live-stream-wearable-ecg-patch-ambulatory-cardiac-monitoring) |
| MoMe ARC (InfoBionic.Ai, USA) | Patch (1-lead config) for extended-duration ECG, alongside the MoMe Kardia MCT platform | 1-lead (ARC) | n/r | MoMe platform supports MCT | n/r | InfoBionic monitoring | FDA 510(k) for MoMe ARC 1-Lead Patch (date not retrieved) | [InfoBionic PR](http://infobionic.ai/press/infobionic-announces-fda-clearance-of-its-mome-arc-patch/) |
| Bioflux / Biotres (Biotricity, USA) | Bioflux: 3-channel MCT. Biotres: compact recorder | Bioflux 3-ch | n/r | Bioflux: real-time MCT | n/r | Biotricity monitoring | Biotres K211709 / K222017 (2022, older) | [Biotricity](https://biotricity.com/); [FDA K222017](https://www.accessdata.fda.gov/cdrh_docs/pdf22/K222017.pdf) |
| Cardea SOLO (Cardiac Insight, USA) | 7-day wearable sensor, 23 g, water-resistant, wire-free | n/r | 7 days | Post-wear. Analysis by software in the clinic (no IDTF needed) | n/r | Software-assisted in-clinic analysis | FDA cleared (2017 launch, older) | [Cardiac Insight](https://www.cardiacinsightinc.com/); [Facebook spec post](https://www.facebook.com/cardiacinsightinc/videos/introducing-cardea-solo-system/649270250891530/) |
| Cardioline Vireo Flex3, Walk Free, Patch Holter, Holter (Cardioline S.p.A., Trento, **Italy**) | Vireo Flex3: wearable ECG patch (2026). Walk Free: wireless 3-ch recorder. Holters: 3–12 leads | Walk Free 3 ch. Holter 3–12 leads | Walk Free up to 9 d. Patch Holter up to 7 d. Holter up to 7 d | Post-wear. Separate Cardioline telemedicine offering | n/r | Cardioline analysis software + telemedicine solutions | CE (MDR class not shown). Vireo Flex3 specs not published on the product page | [Cardioline Patch Holter](https://cardioline.com/categoria-prodotto/patch-holter/); [Cardioline Holter](https://cardioline.com/categoria-prodotto/monitoraggio-holter/); [Cardioline telemedicine](https://cardioline.com/telemedicina/) |
| Comftech HOWDY (Comftech, **Italy**) — textile, overlap only | Textile garment (covered by the smart-textile researcher) | ECG | n/r | **Real-time ECG** | **Respiratory rate, body position** | Used in the "Ultraspecialisti" telemedicine service | n/r | [Comftech](https://comftech.com/it/il-sistema-di-monitoraggio-comftech-per-i-servizi-di-telemedicina-di-ultraspecialisti/) |

n/r = not retrieved in this session.

#### 1b. Insertable cardiac monitors (ICM)
- **Medtronic LINQ II**: AccuRhythm AI (cloud-based deep learning on data flowing into the CareLink network) for AF and pause. It reduces false alerts while keeping true alerts. Medtronic also lists a new PVC algorithm, remote programming and automatic transmissions (no manual transmissions) — [Medtronic LINQ II](https://www.medtronic.com/en-us/healthcare-professionals/products/cardiac-rhythm/cardiac-monitoring/insertable-cardiac-monitors/linq-ii-icm.html)
- LINQ II longevity is 4.5 years at nominal settings — [DAIC](https://www.dicardiology.com/content/next-generation-medtronic-icm-offers-remote-programming-and-improved-longevity). The AccuRhythm AI for LINQ II was FDA-cleared in July 2021 — [Medtronic news 2021](https://news.medtronic.com/2021-07-28-Medtronic-Announces-FDA-Clearance-and-Results-of-Artificial-Intelligence-Algorithms-for-Cardiac-Monitoring). It was extended to Reveal LINQ in April 2023 — [Cardiovascular Business](https://cardiovascularbusiness.com/topics/clinical/heart-rhythm/medtronic-adds-new-ai-models-its-insertable-cardiac-monitors). 510(k) K223630 covers Reveal LINQ, LINQ II and the AccuRhythm AI ECG Classification System — [FDA K223630](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K223630)
- **Abbott Assert-IQ**: FDA-cleared 18 May 2023, with ≥3-year and ≥6-year battery options — [Abbott PR](https://abbott.mediaroom.com/2023-05-18-Abbott-Receives-FDA-Clearance-for-Assert-IQ-TM-Insertable-Cardiac-Monitor-to-Help-Doctors-Monitor-Peoples-Heart-Rhythms-Long-Term). The EL+ version is marketed for 6+ years of AF management. Abbott claims it is "the only ICM system to combine AI, the longest-lasting Bluetooth ICM and IQ Insights", and it supports remote programming — [Abbott HCP page](https://www.cardiovascular.abbott/us/en/hcp/products/cardiac-rhythm-management/insertable-cardiac-monitors/assert-iq-icm.html). The 6-year version is CE-marked. MedTechDive noted that this exceeds LINQ II's 4.5 years — [MedTechDive](https://www.medtechdive.com/news/abbott-ce-mark-insertable-cardiac-monitor-6-years/711327/)
- **Boston Scientific LUX-Dx II+** (model M312): enhancements to reduce false positives and prioritize clinically actionable events. It has a dual-stage algorithm, a myLUX patient app and a Clinic Assistant mobile device — [BSC LUX-Dx II+](https://www.bostonscientific.com/us/en/healthcare-professionals/products/cardiac-monitors/lux-dx-iiplus-insertable-cardiac-monitor-icm-system/fp90000113.html). Original LUX-Dx projected longevity is 3 years — [BSC LUX-Dx](https://www.bostonscientific.com/us/en/healthcare-professionals/products/cardiac-monitors/lux-dx-insertable-cardiac-monitor-icm-system/fp00000496.html). BSC also cites HRS data showing that a BeatLogic-based AI adjudicated ICM atrial-arrhythmia episodes as accurately as three electrophysiologists — [BSC BodyGuardian page, training section](https://www.bostonscientific.com/us/en/healthcare-professionals/products/cardiac-monitors/bodyguardian-mini-remote-cardiac-monitors/fp90000213.html)
- Biotronik BIOMONITOR III is mentioned as a comparator in the Assert-IQ CE coverage — [MedTechDive](https://www.medtechdive.com/news/abbott-ce-mark-insertable-cardiac-monitor-6-years/711327/)

#### 1c. Clinical-grade handheld / personal ECG
- **AliveCor Kardia 12L + KAI 12L**: dual FDA clearance in June 2024, with 35 cardiac determinations — [AliveCor PR](https://alivecor.com/press/press_release/alivecor-launches-kardia-12l-a-first-of-its-kind-ai-powered-12-lead-ecg-system); [Cardiovascular Business 2024](https://cardiovascularbusiness.com/topics/cardiac-imaging/electrocardiography-ecg/alivecor-fda-clearance-advanced-ai-model-handheld-ecg). The next-gen KAI 12L was cleared in Jan 2026 for 5 more determinations (total 39), including short PR, atrial bigeminy, ventricular bigeminy and left axis deviation — [HCPLive Jan 2026](https://www.hcplive.com/view/fda-clears-ai-program-powering-kardia-12l-electrogram-for-5-new-cardiac-determinations); [Cardiac Rhythm News](https://cardiacrhythmnews.com/alivecor-announces-us-fda-clearance-of-new-cardiac-determinations-for-kardia-12l-ecg-system/)
- Kardia 12L was launched in Europe in April 2026 — [Med-Tech Insights](https://med-techinsights.com/alivecor-launches-world-first-kardia-12l-ecg-in-europe/). AliveCor also announced an EMS-use clearance (date not retrieved) — [AliveCor on X](https://x.com/AliveCor/status/2123460596972888297). KardiaMobile Card is 510(k) K211668 — [FDA](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K211668)
- **HeartBeam** (USA): its 3D ECG was cleared for arrhythmia assessment in Dec 2024, and its 12-lead ECG synthesis software in Dec 2025. In Oct 2026 it received FDA Breakthrough designation and TAP acceptance for at-home heart-attack assessment, an indication that is still investigational — [HeartBeam Q3 2026 results](https://www.businesswire.com/news/home/20261112561877/en/HeartBeam-Reports-Third-Quarter-2026-Results)
- **Cardiac Insight Cardea 20/20**: handheld 12-lead ECG oriented to athlete screening — [Cardiac Insight](https://www.cardiacinsightinc.com/)

#### 1d. EU/Italy availability
- iRhythm sells Zio in Austria, the Netherlands, Spain, Switzerland, the US, the UK and (since May 2025) Japan, where Senko Medical Instrument is the exclusive distributor — [iRhythm Japan PR](https://investors.irhythmtech.com/news/news-details/2025/iRhythm-Launches-Zio-Long-Term-Continuous-Monitoring-Service-in-Japan-as-the-Zio-ECG-Recording-and-Analysis-System-Advancing-AI-Powered-Arrhythmia-Detection/default.aspx). The Zio monitor service in Europe started shipping in Sept 2024 — [Investing.com](https://www.investing.com/news/company-news/irhythm-launches-zio-monitor-service-in-europe-93CH-3593125)
- Philips ePatch + Cardiologs AI was rolled out to 14 hospitals in Spain (2024) — [Philips PR](https://www.philips.com/a-w/about/news/archive/standard/news/press/2024/philips-epatch-and-ai-analytics-platform-rolled-out-to-14-hospitals-across-spain-to-monitor-heart-patients). Cardiologs was "the first FDA-cleared ECG analysis solution powered by deep learning" (>20 publications) — [Philips Cardiologs](https://www.philips.com.lb/healthcare/en-LB/ambulatory-monitoring-and-diagnostics/ecg-monitoring/cardiologs-ecg-analysis)
- In the US, Philips MCOT and ePatch joined Optum's network (3.4M members, 22 states) — [Philips PR](https://www.usa.philips.com/about/news-and-insights/press-release/philips-joins-optum-healthcares-network-as-a-preferred-provider-in-the-usa)
- Cardioline is headquartered in Trento (Via Linz 151) and sells patch Holter, Holter and telemedicine in Italy — [Cardioline](https://cardioline.com/categoria-prodotto/patch-holter/)

### Inferences
- In Italy a cardiologist will in practice choose between the hardware/software models (Cardioline, Bittium, Philips ePatch + Cardiologs, PocketECG-based systems) read by the hospital's own staff, and the ICMs. Fully outsourced US-style IDTF services (Zio, BodyGuardian MCT, MCOT) are not offered in Italy; no Italian Zio presence was found.
- BodyGuardian MINI is the only patch here that runs MCT, connected Holter and Holter on one sensor. Its short MCT battery (3–7 days per charge) implies recharging/swaps during a 30-day MCT.
- Philips ePatch's lack of water resistance is a real compliance limitation compared with Zio, BodyGuardian (submersible) and Bittium (IP67).

### Gaps
- Exact FDA 510(k) numbers were not retrieved for: Zio XT/Zio AT (current), BodyGuardian MINI/MINI PLUS, Philips MCOT/ePatch, Bittium Faros, Boston Scientific LUX-Dx II+, Assert-IQ.
- CE MDR class/certificate status was not retrieved for any patch. MDR class IIa is typical but unverified per product, except VitalPatch (CE IIa per its UK distributor).
- Not researched for lack of tool budget: Nuubo (Spain), Rooti Rx, Cardiomo, Medtronic SEEQ (old; SEEQ yield data only as a 2016 AHA abstract, [AHA](https://www.ahajournals.org/doi/10.1161/circ.134.suppl_1.16078)), Withings ScanWatch/BPM Core, Eko, Apple/Samsung ECG, Anumana.
- Italian distributors for Bittium, PocketECG, Philips ePatch and ICMs were not identified.
- Vireo Flex3 (Cardioline) specs are not published on the web page (brochure/manual not parsed).
- Boston Scientific's acquisition of Preventice (BodyGuardian origin) is background knowledge, not re-verified this session.

---

## 2. Which devices offer real-time continuous streaming with alarms vs store-and-forward?

### Takeaway
True MCT with 24/7 attended surveillance and alarms is offered by Philips MCOT, BodyGuardian MINI PLUS (MCT mode), VitalConnect/VitalPatch MCT (now iRhythm), Biotricity Bioflux, InfoBionic MoMe Kardia and PocketECG, with Vivalink as a streaming platform. Zio AT sits in between: it transmits triggered and symptomatic events but does not stream full ECG. Zio monitor/XT, Bardy CAM, Philips ePatch, Cardea SOLO, Bittium Faros and Cardioline patches are store-and-forward (post-wear analysis). ICMs transmit automatically each day via app/bedside monitor with AI-filtered alerts, but are not real-time.

### Cited Findings
- The CPT 93228/93229 (MCT) descriptor requires "concurrent computerized real time data analysis and >24 hours of accessible ECG data storage… ECG triggered and patient selected events transmitted to a remote attended surveillance center for up to 30 days". This is the formal US definition of MCT — [BSC coding guide CY2026](https://www.bostonscientific.com/content/dam/bostonscientific/Reimbursement/RhythmManagement/pdf/External%20Cardiac%20Monitoring%20Coding%20and%20Payment%20Quick%20Reference_Finalv1.pdf)
- BodyGuardian MINI "depending on the prescribed mode, transmits data wirelessly for near real-time review or stores it for retrospective analysis". Its modes are MCT, Connected Holter and Holter — [BSC](https://www.bostonscientific.com/us/en/healthcare-professionals/products/cardiac-monitors/bodyguardian-mini-remote-cardiac-monitors/fp90000213.html)
- Philips MCOT: the sensor sends data via Bluetooth to the monitor, which transmits ECG data automatically over a wireless connection — [myheartmonitor](https://www.myheartmonitor.com/device/mcot-patch/). ePatch is "continuously recording and non-transmitting" — [ePatch patient guide](https://www.myheartmonitor.com/wp-content/uploads/sites/2/2023/04/ePatch-Patch-PEG-220-0690-01-Rev-G-PAL-223903-4.18.23-1.pdf)
- iRhythm CEO: "the MCT category is pushing that data back up through the cloud as the patient wears it". VitalConnect "closes a lot of the competitive gaps much faster" than Zio MCT — [MDDI](https://www.mddionline.com/wearable-medical-devices/irhythm-ceo-on-vitalconnect-acquisition-ai-powered-zio-patch-cyberattack-recovery). Zio AT can address about half of the MCT market, and Zio MCT would add 20–30% — [MedTechDive](https://www.medtechdive.com/news/irhythm-grows-heart-monitoring-leadership-with-288m-vitalconnect-buy/827399/)
- VitalPatch streams over BLE (BT 4.1, ~10 m) with AES-128 encryption and buffers ≥10 h on board (18 h typical) — [FDA IFU](https://www.fda.gov/media/137398/download); [MediBioSense](https://medibiosense.com/solutions/vitalpatch)
- Vivalink markets a "14-day live stream" rechargeable ECG patch for MCT and Holter — [DAIC](https://www.dicardiology.com/content/vivalink-releases-14-day-live-stream-wearable-ecg-patch-ambulatory-cardiac-monitoring); [Vivalink arrhythmia](https://www.vivalink.com/arrhythmia)
- PocketECG is marketed as "online" monitoring, as opposed to offline Holter and patch — [Innovations in CRM](https://www.innovationsincrm.com/latest-news/1241-online-ecg-monitoring-is-more-effective-to-detect-paroxysmal-arrhythmia)
- Bittium Faros: data transfer is by micro-USB download (EDF). A Bluetooth Classic interface exists, but the brochure does not describe attended streaming — [Bittium brochure](https://inmed.com.au/wp-content/uploads/2026/09/Bittium-Cardiac-Monitors_JULY2026_WEB.pdf)
- ICMs: LINQ II offers "no manual transmissions" and cloud AI on CareLink data — [Medtronic](https://www.medtronic.com/en-us/healthcare-professionals/products/cardiac-rhythm/cardiac-monitoring/insertable-cardiac-monitors/linq-ii-icm.html). LUX-Dx alerts are routed through LATITUDE Clarity, and an alert-delivery defect was the subject of a 2026 recall (see Q5) — [Cardiovascular Business](https://cardiovascularbusiness.com/topics/clinical/heart-rhythm/fda-finalizes-recall-due-heart-devices-sending-delayed-alerts-software-update-way)

### Inferences
- Real-time systems depend on software routing to technicians. The Philips MSA failure (2022–2024 events not escalated) shows that "real-time" safety relies on back-end software and center workflows, not just hardware. Cardiologists should ask vendors about escalation SLAs and audit trails.
- In Italy, real-time attended MCT with a 24/7 technician center is essentially unavailable as a turnkey service. Hospitals wanting alarms would need a platform (e.g. PocketECG-type or Vivalink-type) plus their own or an outsourced reading center.

### Gaps
- Real-time capabilities of Cardioline's telemedicine offer and of Bittium's MedicalSuite were not confirmed.
- InfoBionic MoMe Kardia and Biotricity Bioflux alarm/escalation specs were not retrieved.

---

## 3. Which devices integrate respiratory rate, posture/activity or temperature in the same patch?

### Takeaway
Among ECG-centric products, **VitalPatch** (now iRhythm) is the clear multi-sensor patch: ECG, respiratory rate, body and skin temperature, posture, falls and steps. **Bittium Faros** adds a 3D accelerometer (activity/posture). **Vivalink** offers a multi-vital platform. Italian **Comftech** textiles add respiration and posture (smart-textile overlap). Zio, Bardy CAM, ePatch and BodyGuardian specs list no respiration or temperature channel.

### Cited Findings
- VitalPatch measures: ECG, HRV, R-R interval, respiratory rate, body temperature, skin temperature, fall detection, activity (incl. step count) and posture — [FDA IFU](https://www.fda.gov/media/137398/download)
  - Respiratory rate accuracy: MAE <3 breaths/min clinically (10–30 br/min); not valid with pacemakers.
  - Temperature: body 32–42 °C (≤1 °C MAE); skin ±0.3 °C.
  - Falls: >90% sensitivity, >98% specificity. Posture accuracy >70% vs visual.
- MediBioSense lists 8 vitals streamed simultaneously, 7-day single-use wear, FDA cleared and CE Class IIa — [MediBioSense](https://medibiosense.com/solutions/vitalpatch)
- Bittium Faros 180/360/180L include a 3D accelerometer sampled up to 100 Hz — [Bittium brochure](https://inmed.com.au/wp-content/uploads/2026/09/Bittium-Cardiac-Monitors_JULY2026_WEB.pdf)
- Vivalink advertises continuous ECG, temperature and BP monitoring on its platform — [Vivalink](https://www.vivalink.com/)
- Comftech HOWDY SENIOR records heart rate, real-time ECG, respiratory rate and body position — [Comftech](https://comftech.com/it/il-sistema-di-monitoraggio-comftech-per-i-servizi-di-telemedicina-di-ultraspecialisti/)
- The iRhythm–VitalConnect deal was framed as adding "MCT, multi-vitals and hospital monitoring" to Zio — [iRhythm IR Aug 2026](https://investors.irhythmtech.com/news/news-details/2026/iRhythm-to-Acquire-VitalConnect-Expanding-Its-Cardiac-Monitoring-Platform-Across-Ambulatory-Inpatient-and-Hospital-to-Home-Care/default.aspx)

### Inferences
- For HF or post-discharge patients where respiratory rate and temperature trends matter, VitalPatch-class devices overlap with the multiparametric category researched separately. For pure arrhythmia diagnosis, extra sensors add little evidence-backed value except accelerometry (symptom-activity correlation).
- VitalPatch's arrhythmia-detection performance thresholds (≥60–70% sensitivity/PPV) are much lower than those claimed by dedicated LTCM services. Its arrhythmia output therefore likely depends on technician over-read in an MCT service (inference from labeling).

### Gaps
- Whether BodyGuardian MINI has an accelerometer is not stated on the spec page.
- PocketECG's accelerometer and respiration features were not retrieved.

---

## 4. What do comparative studies say about diagnostic yield?

### Takeaway
Longer continuous monitoring with patches (7–14 days) consistently beats 24–48 h Holter for arrhythmia detection and patient comfort. Much of the gain comes from duration, and Holter can still capture some events missed by single-lead patches in the overlapping first 24 h. MCT outperformed loop event monitors in the older Rothman RCT (2007). The industry-sponsored CAMELOT claims analysis ranked Zio highest in yield with the lowest repeat testing. Independent HTA (SHTG Scotland 2025, NICE MTG52 2020) supports Zio XT's higher yield over its total wear time.

### Cited Findings
- **Kim et al. 2025** (patch vs Holter): major arrhythmias detected in 75.5% with patch-ECG vs 48.3% with Holter — [PMC12284308](https://pmc.ncbi.nlm.nih.gov/articles/PMC12284308/)
- **SHTG (Scotland) ECG patch assessment, 3 July 2025** — [SHTG](https://shtg.scot/media/ad3bkw2u/2025-07-03-ecg-patches-assessment-v10.pdf)
  - Zio XT gave a higher diagnostic yield over total wear time than 24-h Holter (NICE MTG52, 2020, n=357).
  - Comfort: 93.7% of participants rated Zio XT comfortable vs 51.7% for Holter.
  - One study found significant rhythms in 46% (n=23) with the patch vs 12% (n=6) with Holter.
  - Pooled AF detection with ECG patches post-stroke was 9.1% (95% CI 3.3–22.6%), and AF detection was comparable at 12–14 days.
  - Holter detected 11 arrhythmias not detected by the patch in one study.
  - In a separate head-to-head (ECG247 Smart Heart Sensor), Holter accuracy was 81% (95% CI 74–87).
- 7-day continuous ECG patch had higher arrhythmia-detection efficacy than 24-h Holter — [PMC10264726](https://pmc.ncbi.nlm.nih.gov/articles/PMC10264726/)
- Kwon et al. 2022 (JMIR) compared 72-h single-lead adhesive patch vs 24-h Holter for AF detection (prospective cohort) — [JMIR](https://www.jmir.org/2022/5/e37970) (older)
- Shin et al. 2026 (J Clin Med): patch-type and lead-type wearable ECG were both clinically feasible in routine practice — [MDPI](https://www.mdpi.com/2077-0383/15/2/526)
- An ESC Congress meta-analysis compared 24-h Holter vs 14-day continuous ECG patch — [ESC 365](https://esc365.escardio.org/presentation/329958) (numbers not retrieved)
- **CAMELOT** (American Heart Journal): Zio LTCM was associated with the highest yield of specified arrhythmia diagnosis and the lowest likelihood of repeat testing compared with all other monitoring services. This is iRhythm-reported, claims-based and industry-affiliated — [iRhythm PR](https://investors.irhythmtech.com/news/news-details/2025/iRhythm-Launches-Zio-Long-Term-Continuous-Monitoring-Service-in-Japan-as-the-Zio-ECG-Recording-and-Analysis-System-Advancing-AI-Powered-Arrhythmia-Detection/default.aspx)
- **MCT vs loop event monitor**: Rothman et al., J Cardiovasc Electrophysiol 2007;18:241–7, a prospective multicenter RCT of MCOT vs standard loop event monitoring — [PubMed 17318994](https://pubmed.ncbi.nlm.nih.gov/17318994/) (older). Commonly cited result: diagnosis in ~88% with MCOT vs ~75% with loop monitoring. These figures were recalled, not re-fetched this session, and should be verified.
- Older yield context: 30-day ambulatory monitoring gave 27.8% diagnostic value in patients with palpitations/syncope/presyncope, vs 15.8% for 24-h Holter in one study — [PMC8288067](https://pmc.ncbi.nlm.nih.gov/articles/PMC8288067/)
- PocketECG (company-promoted study): online monitoring gave significantly higher diagnostic yield than fixed 24/48-h Holter and multi-day patches — [Innovations in CRM](https://www.innovationsincrm.com/latest-news/1241-online-ecg-monitoring-is-more-effective-to-detect-paroxysmal-arrhythmia) (industry-sponsored)
- AI performance claims:
  - BeatLogic: minimum-duration thresholds improve AF/VT detection — [BSC](https://www.bostonscientific.com/us/en/healthcare-professionals/products/cardiac-monitors/bodyguardian-mini-remote-cardiac-monitors/fp90000213.html)
  - AccuRhythm: reduces false AF/pause alerts in ICMs while preserving sensitivity — [Medtronic](https://www.medtronic.com/en-us/healthcare-professionals/products/cardiac-rhythm/cardiac-monitoring/insertable-cardiac-monitors/reveal-linq-icm.html)
- Smartwatch ECG vs continuous monitoring for post-ablation AF burden (Aguilar 2025) — [PMC13564214](https://pmc.ncbi.nlm.nih.gov/articles/PMC13564214/)
- European guidance:
  - EHRA practical guide "How to use digital devices to detect and manage arrhythmias" — [ResearchGate](https://www.researchgate.net/publication/359743228_How_to_use_digital_devices_to_detect_and_manage_arrhythmias_an_EHRA_practical_guide) (2022, older)
  - EHJ 2026 review on wearables and remote monitoring — [EHJ 2026](https://academic.oup.com/eurheartj/article/47/18/2130/8540180)

### Inferences
- The evidence supports this hierarchy:
  - 24–48 h Holter: daily symptoms only.
  - 7–14-day patch: weekly or less frequent symptoms, and AF screening/burden.
  - MCT: when real-time detection of dangerous arrhythmias matters (syncope with high-risk features, VT suspicion).
  - ICM: infrequent symptoms (> monthly) and cryptogenic stroke.
- Most "patch superiority" results compare unequal durations. Same-duration comparisons show smaller differences, and single-lead patches can miss some morphology-dependent findings (wide-complex discrimination, ST).

### Gaps
- No head-to-head RCT between commercial patch brands (Zio vs BodyGuardian vs ePatch vs CAM) was found.
- Exact pooled estimates from the ESC 365 meta-analysis and the full CAMELOT numbers were not retrieved.
- The 2024 ESC AF guideline / 2025–2026 EHRA statements on ambulatory ECG were not fetched in this session.

---

## 5. 2024–2026 news: warning letters, recalls, acquisitions, clearances, AI

### Takeaway
2024–2026 was dominated by iRhythm:
- It resolved its 2023 warning-letter remediation through Zio AT 510(k)s (Oct 2024).
- It filed Zio MCT (Q3 2025).
- It bought VitalConnect for ~$287.5M (announced Aug 2026, closed 5 Oct 2026), then pushed the Zio MCT FDA filing to 2027. This triggered law-firm investigations (Nov 2026).

Safety signals:
- Philips MCOT software: Class I correction, Jan 2025, with 109 injuries and 2 deaths reported.
- Boston Scientific LUX-Dx alert delays: Class II, Sept 2026.
- A Medtronic LINQ II reset issue: Class II, date not retrieved.

AI: AliveCor KAI 12L expanded (39 determinations, Jan 2026), and HeartBeam progressed (Breakthrough designation, Oct 2026).

### Cited Findings
- **iRhythm warning letter** dated 25 May 2023 (older) — [FDA](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/irhythm-technologies-inc-643474-05252023). It cited labeling, quality-system and MDR violations, including at least two patient deaths reported outside the 30-day window — [MassDevice](https://www.massdevice.com/fda-clears-second-set-of-changes-to-irhythm-zio-at-to-resolve-warning-letter/)
- The second Zio AT 510(k) (design modifications + labeling) was cleared Oct 2024. The Zio MCT submission was delayed to Q3 2025 — [MedTechDive](https://www.medtechdive.com/news/FDA-iRhythm-second-510k-response-warning-letter/731769/); [iRhythm IR](https://investors.irhythmtech.com/news/news-details/2024/iRhythm-Technologies-Receives-FDA-510k-Clearance-for-Design-Modifications-to-Its-Zio-AT-Device/default.aspx)
- Zio MCT was submitted to the FDA in Q3 2025 — [MassDevice Oct 2025](https://www.massdevice.com/irhythm-submits-zio-mct-fda-q3-2025/)
- **VitalConnect acquisition**: ~$287.5M, announced Aug 2026 — [iRhythm IR](https://investors.irhythmtech.com/news/news-details/2026/iRhythm-to-Acquire-VitalConnect-Expanding-Its-Cardiac-Monitoring-Platform-Across-Ambulatory-Inpatient-and-Hospital-to-Home-Care/default.aspx); [MedTechDive](https://www.medtechdive.com/news/irhythm-grows-heart-monitoring-leadership-with-288m-vitalconnect-buy/827399/)
  - Per law-firm releases, the deal closed 5 Oct 2026.
  - iRhythm said it "no longer plan[s] to submit Zio MCT to the FDA later this year" and now expects to submit in 2027.
  - Earlier (19 Feb 2026), management had said Zio MCT was "under review with the FDA", with release expected H1 2027 — [Kirby McInerney via GlobeNewswire, 25 Nov 2026](https://www.globenewswire.com/news-release/2026/11/25/3410341/937/en/irhythm-holdings-inc-investigation-continues-investors-may-contact-kirby-mcinerney-llp-a-securities-fraud-law-firm-if-you-lost-money-on-your-irtc-investments.html); [Morningstar/BusinessWire](https://www.morningstar.com/news/business-wire/20261113461294/irhythm-holdings-inc-investigation-irtc-securities-investors-encouraged-to-contact-kirby-mcinerney-llp-about-their-rights)
  - **Source conflict**: "under review" (Feb 2026) vs "no longer plan to submit… later this year" (Q3 2026 call) is inconsistent as quoted. It may mean a withdrawal and planned resubmission. The original transcripts were not checked, and law-firm releases are advocacy sources.
  - iRhythm also tied a slowdown in Zio AT sales to the VitalConnect integration — [Morningstar/PRNewswire](https://www.morningstar.com/news/pr-newswire/20261106ny91572/irtc-investigation-notice-suewallst-notifies-investors-of-pending-investigation-into-irhythm-technologies-inc-irtc)
- **iRhythm cybersecurity incident (2026)**: a threat actor claimed to have obtained protected patient information and proprietary data — [MDDI](https://www.mddionline.com/wearable-medical-devices/irhythm-ceo-on-vitalconnect-acquisition-ai-powered-zio-patch-cyberattack-recovery)
- **Zio Japan**: PMDA/MHLW approval Sept 2024 — [10-K](https://www.sec.gov/Archives/edgar/data/1388658/000138865826000011/irtc-20251231.htm). Commercial launch May 2025 — [iRhythm IR](https://investors.irhythmtech.com/news/news-details/2025/iRhythm-Launches-Zio-Long-Term-Continuous-Monitoring-Service-in-Japan-as-the-Zio-ECG-Recording-and-Analysis-System-Advancing-AI-Powered-Arrhythmia-Detection/default.aspx)
- **Philips MCOT Monitoring Service Application (BTPS-1000)** — [FDA](https://www.fda.gov/medical-devices/medical-device-recalls-and-early-alerts/outpatient-telemetry-correction-philips-issues-correction-monitoring-service-application-used-mobile)
  - Problem: ECG events received from July 2022 to July 2024 were not properly routed for technician review. These included AF, pause, SVT, VT and 2nd/3rd-degree AV block.
  - Harm: 109 injuries and 2 deaths reported.
  - Actions: Urgent Medical Device Correction sent 18 Dec 2024; FDA notice of 14 Jan 2025 classed it as the most serious type (Class I).
- **Boston Scientific LUX-Dx family**: Class II recall finalized (article of 3 Sept 2026) — [Cardiovascular Business](https://cardiovascularbusiness.com/topics/clinical/heart-rhythm/fda-finalizes-recall-due-heart-devices-sending-delayed-alerts-software-update-way); [FDA recall record](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRES/res.cfm?id=221755)
  - Problem: AF Burden Alerts were not sent as intended by the LATITUDE Clarity server. No injuries or deaths.
  - Fix: a software update is planned. Interim workaround: set the AF burden threshold to anything other than ">0 h/day" and set the AF event duration to 2 min.
- **Medtronic LINQ II**: Class 2 recall. LINQ II devices that undergo a partial electrical reset appear programmed ON but can no longer detect — [FDA recall record](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRes/res.cfm?id=187843) (date not retrieved; possibly pre-2024)
- **AliveCor**: KAI 12L next-gen cleared Jan 2026 (39 determinations) — [MassDevice](https://www.massdevice.com/alivecor-another-fda-nod-ai-ecg-12l/). Kardia 12L launched in Europe in April 2026 — [Med-Tech Insights](https://med-techinsights.com/alivecor-launches-world-first-kardia-12l-ecg-in-europe/)
- **HeartBeam**: 12-lead synthesis clearance Dec 2025, and FDA Breakthrough + TAP in Oct 2026 for at-home heart-attack assessment (investigational) — [BusinessWire](https://www.businesswire.com/news/home/20261112561877/en/HeartBeam-Reports-Third-Quarter-2026-Results)
- **Medicalgorithmics**: 2026 strategic pivot to licensing FDA-cleared AI algorithms to third-party devices. New US partner contract (≥PLN 786k first-year fees) — [Medicalgorithmics 47/2026](https://www.medicalgorithmics.com/current-reports/47-2026-conclusion-of-an-agreement-with-a-us-partner-providing-for-total-fees-of-at-least-pln-786-thousand-for-the-first-year-of-cooperation/); [strategy](https://www.medicalgorithmics.com/medicalgorithmics-unveils-new-growth-strategy-through-2026/)
- **InfoBionic.Ai**: MoMe ARC 1-lead patch FDA clearance (date not retrieved) — [InfoBionic](http://infobionic.ai/press/infobionic-announces-fda-clearance-of-its-mome-arc-patch/)
- **Philips**: showcased MCOT, ePatch, Cardiologs and ISECG as a unified ambulatory platform at HRS 2026 and ESC 2026 (marketing sources) — [YouTube ESC 2026](https://www.youtube.com/watch?v=3R8wPC1Wn10); [Philips whitepaper Jul 2026](https://www.documents.philips.com/assets/20260729/beb4a21c07a24284af7ab49601077c61.pdf)

### Inferences
- The two most serious 2024–2026 safety events (Philips MSA, LUX-Dx Clarity) were **software/back-end routing failures, not sensor failures**. Due diligence should cover the alert pipeline and its post-market history.
- iRhythm now owns two MCT paths (VitalPatch now, Zio MCT later). Product continuity for VitalPatch customers and a possible future EU MCT launch are open questions.

### Gaps
- No 2024–2026 FDA warning letters to other ambulatory ECG makers were found (searches were limited).
- Anumana, Eko and Philips Cardiologs 2025–2026 AI clearances were not retrieved.
- No EU (EUDAMED/national competent authority) field safety notices were searched.

---

## 6. Indicative costs and reimbursement (USA 2026, Italy)

### Takeaway
In the US, CMS 2026 national rates are:
- ≤48 h Holter: ~$70 global.
- 48 h–7 d and 7–15 d extended Holter: ~$279–290 global.
- External event/loop recorder: ~$170.
- MCT: ~$759 technical plus ~$25 professional.

The iRhythm CEO says LTCM rates keep rising in the CY2027 proposed rule. In Italy, a 24-h Holter is tariffed at about €80–90 in supplementary-fund schedules. The new national LEA outpatient tariffs took effect on 21 Sept 2026, but the specific extended-Holter/patch codes were not retrieved.

### Cited Findings
- CY2026 Medicare national amounts — [BSC coding & payment quick reference](https://www.bostonscientific.com/content/dam/bostonscientific/Reimbursement/RhythmManagement/pdf/External%20Cardiac%20Monitoring%20Coding%20and%20Payment%20Quick%20Reference_Finalv1.pdf):

| CPT code(s) | Service | Component | CY2026 amount |
|---|---|---|---|
| 93224 | ≤48 h Holter | global | $70.48 |
| 93241 | >48 h–7 d | global | $279.23 |
| 93243 | >48 h–7 d | scanning (tech) | $244.83 |
| 93245 | >7–15 d | global | $289.59 |
| 93247 | >7–15 d | scanning (tech) | $253.18 |
| 93248 | >7–15 d | interpretation (prof) | $24.72 |
| 93229 | MCT | technical/IDTF | $758.53 |
| 93228 | MCT | professional | $25.05 |
| 93268 | External event recorder | global | $169.68 |
| 93271 | External event recorder | transmission/analysis | $137.61 |

- iRhythm CEO: the CY2027 proposed rule continues 2026's increases in long-term cardiac monitoring rates (company view) — [MDDI](https://www.mddionline.com/wearable-medical-devices/irhythm-ceo-on-vitalconnect-acquisition-ai-powered-zio-patch-cyberattack-recovery). The CY2026 PFS final rule is CMS-1832-F — [CMS fact sheet](https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2026-medicare-physician-fee-schedule-final-rule-cms-1832-f)
- Italy (supplementary health-fund schedules, not SSN):
  - "ECG dinamico secondo Holter – 24 ore": €80.00 (FASDAC 2025) — [FASDAC](https://www.fasdac.it/Images/Reviews/Nomenclatore%20tariffario%20Fasdac%2001012025_v1.pdf)
  - Holter 24 h: €90.00 (FISDE, valid to 30 Sept 2025) — [FISDE](https://www.fisde.it/wp-content/uploads/2025/09/Nomenclatore-tariffario-in-vigore-fino-al-30-settembre-2025.pdf)
- Italian Ministry of Health: from 21 Sept 2026, outpatient specialist (and prosthetic) tariffs from the new ministerial decree are in force — [Ministero della Salute](https://www.salute.gov.it/new/it/tema/programmazione-e-finanziamento-del-ssn/tariffari-nazionali-delle-prestazioni-del-ssn/)
- Regional tariff lists include loop recorder insertion and removal codes (e.g. Lazio) — [ASL Roma 2 tariffario](https://www.aslroma2.it/attachements/j4/com_content.article/DG1187-tariffario-specialistica-ambulatoriale.pdf)

### Inferences
- The US business model rewards outsourced 7–15-day LTCM and MCT services (technical fee ≫ professional fee). In Italy, low Holter tariffs and the absence of a distinct multi-day patch tariff favour reusable hardware read in-house over per-test disposable services, which explains Zio's absence from Italy.

### Gaps
- Device list prices (per-patch cost to an Italian hospital) were not found for any product.
- The SSN national tariff for "ECG dinamico" under the new 2026 nomenclatore, any multi-day Holter code, and ICM DRG/reimbursement amounts in Italy were not retrieved.
- UK NHS tariff and NICE MTG52 cost figures were not retrieved.
