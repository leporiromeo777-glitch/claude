# Regulatory, reimbursement and economic framework for cardiac remote patient monitoring (telemonitoring) — Italy/EU and USA (status as of 26 November 2026)

Scope note: research run on 26 Nov 2026. Several items changed during 2026 (EU AI Act "Digital Omnibus", EUDAMED mandatory use, new Italian LEA decree, CMS CY2027 final rule, 2026 ESC HF guidelines). Product catalogues are out of scope; only prices are covered. Where a figure comes from a vendor/billing blog or a secondary source rather than the primary regulator, this is stated.

## 1. EU / Italy device regulation: MDR classes, transition, EUDAMED, AI Act, GDPR/EHDS, standards — and what certifications to demand from a vendor

### Takeaway
Under the MDR, cardiac telemonitoring hardware and software are at least class IIa, and become class IIb when they monitor vital parameters (heart rate, blood pressure, respiration) whose variations could put the patient in immediate danger, which covers alarm-based monitoring. Legacy (MDD) devices can stay on the market until 31 Dec 2027/2028 only if the conditions of Regulation 2023/607 were met. EUDAMED became mandatory on 28 May 2026, and devices already on the market must be registered by 28 Nov 2026. The AI Act's high-risk obligations for AI in medical devices were postponed to 2 Aug 2028 by Regulation (EU) 2026/1744. The EHDS (Reg. 2025/327) applies from March 2027, with the obligations for EHR systems starting on 26 March 2029.

### Cited Findings
**MDR classification (Annex VIII)**
- Rule 10 (active devices for diagnosis/monitoring): class IIa "if they are intended to allow direct diagnosis or monitoring of vital physiological processes, unless they are specifically intended for monitoring of vital physiological parameters and the nature of variations of those parameters is such that it could result in immediate danger to the patient, for instance variations in cardiac performance, respiration, activity of the central nervous system… in which cases they are classified as class IIb." — [MDR Annex VIII text](https://www.medical-device-regulation.eu/2019/08/08/annex-viii/)
- Rule 11 (software): "Software intended to monitor physiological processes is classified as class IIa, except if it is intended for monitoring of vital physiological parameters, where the nature of variations of those parameters is such that it could result in immediate danger to the patient, in which case it is classified as class IIb." Software providing information for diagnostic or therapeutic decisions starts at IIa. It rises to IIb if a wrong decision could cause serious deterioration of health or surgery, and to III if it could cause death or irreversible deterioration. — [MDR Annex VIII text](https://www.medical-device-regulation.eu/2019/08/08/annex-viii/); [OpenRegulatory summary of MDCG 2019-11](https://openregulatory.com/mdcg/mdcg-2019-11)
- MDCG 2019-11 lists respiration, heart rate, cerebral functions, blood gases, blood pressure and body temperature as examples of "vital physiological parameters" (sub-rule 11b). — [MDCG 2019-11 (European Commission)](https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf); [Critical Catalyst](https://criticalcatalyst.com/mdr-rule-11-software-classification/)

**MDR transition (Regulation (EU) 2023/607) and the MDR revision**
- Legacy devices "may remain on the market until 31 December 2027 or 2028 depending on class, but only where the conditions of Regulation (EU) 2023/607 were met." — [QSE – EU MDR transition](https://enhancequality.com/standards/eu-mdr/transition); legal text: [Regulation (EU) 2023/607, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2023/607/oj)
- The European Commission has proposed a targeted simplification of the MDR/IVDR to "simplify the applicable rules, reduce the…" burden. — [JD Supra](https://www.jdsupra.com/legalnews/european-commission-issues-proposal-to-3375410/); [Intertek, Feb 2026](https://www.intertek.com/blog/2026/02-10-major-simplification-of-medical-device-regulations-proposed/)
- Status: "The EU proposal to simplify the MDR and IVDR is not law. The Parliament committee has not voted and the Council had no general approach on 5 June 2026." — [VeroPharma Group, 30 Jun 2026](https://veropharmagroup.com/insights/medical-devices/2026-06-30-eu-mdr-ivdr-simplification-proposal-still-pending)
- An npj Digital Medicine analysis covers the proposed MDR reform and its implications for AI-enabled devices, and notes that the Digital Omnibus on AI is the route currently chosen to resolve the MDR–AI Act overlap. — [npj Digital Medicine 2026](https://www.nature.com/articles/s41746-026-03475-8)

**EUDAMED**
- Four EUDAMED modules (Actor registration, UDI/Device registration, Notified Bodies & Certificates, Market Surveillance) became mandatory on 28 May 2026. — [IntuitionLabs, citing Malta Medicines Authority, AEMPS and EC](https://intuitionlabs.ai/articles/eudamed-2026-registration-data-integration); [LinkedIn summary](https://www.linkedin.com/pulse/eudamed-goes-mandatory-2026-arun-s-ic46c)
- Legacy and MDR devices placed on the market before mandatory use must be registered in the UDI/Device module by **28 November 2026** (the Commission-published deadline). — [IntuitionLabs citing EC document](https://intuitionlabs.ai/articles/eudamed-2026-registration-data-integration); [Casus Consulting](https://casusconsulting.com/calendar/eudamed-use-expected-to-be-mandatory-q1-2026/)
- The mandatory-use mechanism (6 months after the notice in the OJEU) came from the 2024 MDR/IVDR amendment. — [Casus Consulting](https://casusconsulting.com/commission-publishes-updated-draft-eudamed-timeline/); [MDlaw on the Jan 2024 proposal](https://mdlaw.eu/mdr/ec-proposal-to-extend-ivd-legacy-period-and-make-eudamed-mandatory-sooner/)

**EU AI Act and the Digital Omnibus**
- The Digital Omnibus on AI is **Regulation (EU) 2026/1744**. High-risk obligations for AI in Annex I products (medical devices, IVDs) apply from **2 August 2028**, moved from 2 Aug 2027. Stand-alone Annex III systems apply from 2 Dec 2027, moved from 2 Aug 2026. — [Medqair (links EUR-Lex 2026/1744)](https://medqair.com/regulations/eu-ai-act/); [Healthseed](https://www.healthseed.vc/insights/eu-ai-act-healthcare-deadlines); [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)
- The Omnibus entered into force in August 2026 (Healthseed citing Hunton). — [Healthseed](https://www.healthseed.vc/insights/eu-ai-act-healthcare-deadlines)
- The original Commission proposal (19 Nov 2025) tied the date to 12 months after "support measures" were confirmed, with a long-stop of 2 Aug 2028. It also allows real-world testing of MDR/IVDR high-risk AI "at any time" before market placement. — [Sidley, Dec 2025](https://www.sidley.com/en/insights/newsupdates/2025/12/eu-digital-omnibus-implications-for-medtech-companies); [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-eu-ai-act-high-risk-deadline-omnibus-20260/)
- The EP IMCO and LIBE committees voted on 18 March 2026 to support the Omnibus. — [Specculo](https://specculo.com/eu-ai-act-omnibus-hrai-delay-medical-devices/)
- AI in a medical device counts as high-risk (Art. 6(1)) when the AI is the device or a safety component of it and the MDR requires notified-body assessment. This "covers most diagnostic and monitoring software in class IIa and above." The Omnibus lets the Commission limit AI Act requirements where sectoral law gives equivalent protection. — [VDF.ai](https://vdf.ai/blog/eu-ai-act-healthcare-medical-devices/); [npj Digital Medicine](https://www.nature.com/articles/s41746-026-03475-8)

**GDPR / Italian data rules / EHDS**
- The Italian National Telemedicine Platform (PNT) has its own data-processing rules, set by the Ministry of Health decree of **19 November 2025**. — [Dose Digitale (citing telemedicina.gov.it)](https://dosedigitale.substack.com/p/telemedicina-nei-nuovi-lea-cosa-e)
- EHDS, Regulation (EU) 2025/327: adopted 11 Feb 2025, in force 26 March 2025, generally applicable from 26 March 2027. From 26 March 2029, EHR systems placed on the market must meet the common specifications for the first priority categories (patient summaries, ePrescriptions), and most secondary-use rules apply. The second group (images, lab results, discharge reports) follows on 26 March 2031. It amends Directive 2011/24/EU and the Cyber Resilience Act (Reg. 2024/2847). — [European Commission EHDS page](https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en); [NHIMG EHDS guide](https://nhimg.org/european-health-data-space-ehds-guide); [GenCompl](https://gencompl.ai/regulations/ehds)
- EHDS has product rules for EHR systems and labelling rules for wellness apps (Arts 25–27 and 47–49) that apply from 26 March 2029. — [Pitch.law](https://pitch.law/academy/european-health-data-space-health-record-systems-and-wellness-apps)

**Standards**
- IEC 60601-1-11 covers medical electrical equipment used in home healthcare, and IEC 60601-2-47 covers ambulatory ECG (Holter) monitors. — [MECA IEC 60601 standards list 2024](https://60601-1.com/wp-content/uploads/2024/04/MECA-IEC-60601-IEC-ISO-80601-Medical-Standards-List-Rev-2024-04-16.pdf)
- **ISO 80601-2-61:2026** (pulse oximeter basic safety and essential performance) is a new 2026 edition. The previous EN ISO 80601-2-61:2019 was identical to ISO 80601-2-61:2017. — [IECEE](https://www.iecee.org/certification/iec-standards/iso-80601-2-612026); [Accuris BS EN ISO 80601-2-61:2019](https://store.accuristech.com/pip/products/preview/2034225)

### Inferences
- **Vendor certification checklist (EU/Italy)**, derived from the rules above:
  - Check the CE marking under the MDR, the notified-body number and the certificate scope. If the device is a "legacy" MDD device, ask for evidence that the 2023/607 conditions were met: QMS in place, NB application lodged and written agreement signed. Otherwise the device should not be on the market.
  - Check the class claimed. A system that generates alarms on HR, rhythm, SpO2 or BP for clinical action should normally be IIb. A IIa claim needs a justified intended purpose, for example non-alarm, periodic review.
  - Check EUDAMED: the actor SRN and the UDI-DI registration (deadline 28 Nov 2026).
  - Ask for ISO 13485 certification, and a technical file built on ISO 14971 (risk), IEC 62304 (software lifecycle), IEC 62366-1 (usability), IEC 60601-1, -1-2 and -1-11 (home use), and the relevant particular standards (IEC 60601-2-47 for ECG, ISO 81060-2 for cuff BP, ISO 80601-2-61 for SpO2, preferably the 2026 edition).
  - Ask for the clinical evaluation report and the PMCF plan.
  - Ask for a GDPR Art. 28 data processing agreement, a DPIA and the EU data location.
  - For AI arrhythmia algorithms: the notified-body scope should cover the algorithm, and the vendor should plan for AI Act conformity by 2 Aug 2028.
- Standards such as IEC 62304, ISO 14971, ISO 13485 and ISO 81060-2/-3 are cited from background knowledge as the usual state-of-the-art set. I did not check their harmonised status in the OJEU in this session.
- For Italian public buyers, integration with the regional telemedicine infrastructure, the PNT and the FSE (Fascicolo Sanitario Elettronico) is a de facto requirement on top of CE marking (see Section 2).

### Gaps
- I could not open the EUR-Lex text of 2023/607 in this session. The detailed conditions (QMS by 26 May 2024, NB application by 26 May 2024, written agreement by 26 Sept 2024) and the class split (31 Dec 2027 for class III and IIb implantable; 31 Dec 2028 for other IIb, IIa and Is/Im) come from background knowledge and should be checked against EUR-Lex.
- The exact date of the Commission's MDR/IVDR simplification proposal (believed to be December 2025) and its content were not confirmed from a primary source.
- I did not research GDPR Art. 9 specifics or opinions of the Italian Garante on telemonitoring in this session.
- I did not check whether ISO 81060-3 (continuous cuffless BP) is harmonised or required. The FDA's equivalent work is a Jan 2026 draft guidance (see Section 3).

## 2. Italy: national telemedicine framework, PNRR, Piattaforma Nazionale, LEA/nomenclatore and regional tariffs

### Takeaway
Italy has no single national tariff for cardiac telemonitoring. The national nomenclatore (DM 25 Nov 2024, in force 30 Dec 2024) contains no telemedicine tariffs and no CIED remote-control code. The 2026 LEA update (DPCM 7 Aug 2026, in force 30 Oct 2026) confirms telemedicine as a way of delivering LEA but still leaves tariffs to the regions. Regional tariffs for remote control of implanted cardiac devices (DCEI/CIED) are about €23–26 per service (Veneto, Piemonte, Liguria, Puglia). Lombardy assimilates telemonitoring and teleassistance to a follow-up visit (about €17.90). The PNRR target of 300,000 patients assisted by telemedicine was exceeded, with 467,479 patients.

### Cited Findings
**National framework**
- *Indicazioni nazionali per l'erogazione di prestazioni in telemedicina*, Accordo Stato-Regioni Rep. Atti n. 215/CSR of 17 Dec 2020:
  - formally brings telemedicine services into the SSN;
  - requires the reporting information flows to be updated;
  - sets **tariff equivalence with in-person services**;
  - defines teleconsulto as a medical act.

  — [ISS, Rapporti ISTISAN 25/16 (2025)](https://www.iss.it/documents/20126/9975143/25-16+web.pdf/24e67c50-1206-3197-341e-48f7f0718405?t=1763379477314)
- **DM 21 settembre 2022** approves the guidelines for telemedicine services (functional requirements and service levels) for regional infrastructures under PNRR M6C1 sub-investment 1.2.3. Televisita, teleconsulto/teleconsulenza, telemonitoraggio and teleassistenza are the minimum services an infrastructure must provide. — [ISS Rapporti ISTISAN 25/16](https://www.iss.it/documents/20126/9975143/25-16+web.pdf/24e67c50-1206-3197-341e-48f7f0718405?t=1763379477314); [Studio Legale Stefanelli](https://www.studiolegalestefanelli.it/it/approfondimenti/telemedicina-e-pnrr-a-che-punto-siamo)
- The DM of 29 April 2022 approved organisational guidelines for the "Modello digitale per l'attuazione dell'assistenza domiciliare" (milestone EU M6C1-4). The ISS report refers to it alongside "DM 77/2022". — [ISS Rapporti ISTISAN 25/16](https://www.iss.it/documents/20126/9975143/25-16+web.pdf/24e67c50-1206-3197-341e-48f7f0718405?t=1763379477314)
- The national model distinguishes televisita, teleconsulto medico, teleconsulenza sanitaria, teleassistenza and telemonitoraggio as separate services. Newer AGENAS operating models stress a responsibility matrix (who is responsible, consulted and informed at each step). — [Dose Digitale](https://dosedigitale.substack.com/p/telemedicina-nei-nuovi-lea-cosa-e)

**PNRR Mission 6 and the Piattaforma Nazionale di Telemedicina (PNT)**
- Investment M6C1 1.2.3, "Telemedicina per un migliore supporto ai pazienti cronici", was split into two sub-interventions by the DM of 1 April 2022. Target **M6C1-9: at least 300,000 people assisted through telemedicine tools by T4 2025**. — [AGENAS](https://www.agenas.gov.it/component/content/article/2329-la-telemedicin?Itemid=&catid=85)
- The target was exceeded with **467,479 patients**. — [Il Sole 24 Ore](https://www.ilsole24ore.com/art/dagli-ospedali-digitali-telemedicina-target-pnrr-centrati-ma-quali-benefici-i-cittadini-AIqCjwSB); [Doctor33 / GIMBE](https://www.doctor33.it/articolo/66856/pnrr-salute-gimbe-centrati-i-target-ue-su-telemedicina-ospedali-e-fse-nodi-su-obiettivi-e-trasparenza); [Quotidiano Sanità](https://www.quotidianosanita.it/governo-e-parlamento/pnrr-salute-missione-6-verso-il-traguardo-in-chiusura-la-rendicontazione-degli-obiettivi-per-la-x-e-ultima-rata/)
- ARIS questioned how the PNRR deadlines and the target count were reported. — [ARIS](https://www.arisassociazione.it/news/focus/dubbi-sconcertanti-sulle-scadenze-del-pnrr)
- Minister Schillaci said telemedicine had about €1.5 billion against the 300,000 target. — [Sanità33](https://www.sanita33.it/governo-e-parlamento/7751/pnrr-schillaci-telemedicina-oltre-il-target-ue-presi-in-carico-1-6-milioni-di-over-65.html)
- When the PNT was presented (Feb 2025), AGENAS projected at least 300,000 patients by Dec 2025, "arriving at about 790,000 patients in 2026". — [Il Sole 24 Ore Radiocor, 4 Feb 2025](https://www.ilsole24ore.com/radiocor/nRC_04.02.2025_14.30_468); [GIMEMA](https://www.gimema.it/presentata-agenas-piattaforma-nazionale-telemedicina/)
- The PNT, with AGENAS as implementing body, is live at pnt.agenas.it. — [ForumPA](https://www.forumpa.it/sanita/telemedicina-la-sanita-del-futuro-al-centro-della-rubrica-del-ministero-della-salute/)
- A 2025 decree (GU 29 March 2025) allocated funds for integrating regional systems with the PNT, local integrations, medical devices and software development. — [Dose Digitale citing Gazzetta Ufficiale](https://dosedigitale.substack.com/p/telemedicina-nei-nuovi-lea-cosa-e)

**LEA and nomenclatore**
- The new national nomenclatore for outpatient specialist care came into force on **30 December 2024**. — [Ospedale Niguarda](https://www.ospedaleniguarda.it/news/leggi/nuovo-nomenclatore-tariffario); [Lombardy DGR XII/3630 of 16/12/2024](https://www.assortopedia.it/normativa/atti-regionali/lombardia/309-recepimento-nuovo-tariffario-elenco-1-ex-intesa-stato-regioni-14-11-2024/file.html)
- According to ISS, "all'interno del Decreto non sono ancora presenti tariffe relative alle prestazioni di telemedicina" (the decree does not yet contain tariffs for telemedicine services). The national nomenclatore/CUR does not cover remote control of CIEDs or teleconsulto directly. — [ISS Rapporti ISTISAN 25/16](https://www.iss.it/documents/20126/9975143/25-16+web.pdf/24e67c50-1206-3197-341e-48f7f0718405?t=1763379477314)
- **New LEA update:** DPCM 7 agosto 2026 and DM 3 agosto 2026, GU n. 227 of 30 Sept 2026, in force **30 Oct 2026**. They amend the DPCM of 12 Jan 2017 but **do not create a national telemedicine nomenclatore**. Telemedicine is treated as a way of delivering LEA services, and remuneration still depends on regional acts. — [Dose Digitale, Oct 2026](https://dosedigitale.substack.com/p/telemedicina-nei-nuovi-lea-cosa-e) (citing [Regioni.it](https://www.regioni.it/news/2026/10/01/modifiche-e-integrazioni-al-dpcm-12-1-2017-in-materia-di-livelli-essenziali-di-assistenza-dpcm-7-8-2026-gazzetta-ufficiale-n-227-del-30-9-2026-664815/))
- National tariffs reported for comparison (fpress, Sept 2026, on telecardiology in pharmacies):

  | Service | Tariff |
  |---|---|
  | ECG without visit | **€12.05** |
  | 24h ambulatory blood pressure monitoring (Holter pressorio) | **€42.85** |
  | Holter ECG (24h) | **€64.25** |

  — [Fpress](https://www.fpress.it/filiera/in-vigore-il-nuovo-nomenclatore-cosa-cambia-per-la-telecardiologia-in-farmacia/)

**Regional tariffs and codes**

All entries below are from the [ISS Rapporti ISTISAN 25/16 survey](https://www.iss.it/documents/20126/9975143/25-16+web.pdf/24e67c50-1206-3197-341e-48f7f0718405?t=1763379477314) unless another source is shown.

| Region | Act | Service | Tariff |
|---|---|---|---|
| Veneto | DGR 478/2019 | DCEI/CIED telecontrol | **€25.55** |
| Piemonte | DGR 13-2103/2020 | DCEI/CIED telecontrol | **€23.20** |
| Liguria | DCS 417/2020 | DCEI/CIED telecontrol | **€23.24** |
| Puglia | DGR 1179/2021 | DCEI/CIED telecontrol | **€25** |
| Lombardia | DGR XII/3630/2024 | Telemonitoring and teleassistance: own code, assimilated to a follow-up visit | about **€17.90** (televisita di controllo) |
| Lombardia | DGR XII/3630/2024 | Teleconsulto TC.01 (GP/paediatrician to specialist) and TC.02 (specialist to specialist) | **€17.90** |
| Lazio | Determinazione G00001 of 2 Jan 2025 | Televisita | **€17.90** |
| Lazio | Delibera 338 of 28 June 2023 | Teleconsulto | No separate tariff found |
| Trento (Provincia autonoma) | DGP 456/2020 | Teleconsulto | **€53.65** (not operational after 30 Dec 2024; DGP 2179/2024 keeps tariffs the same as in-person) |
| Toscana | DGR 464/2020 | Teleconsulto | Reporting only, no tariff |
| Campania | DGRC 6/2021 | Teleconsulto ("Sinfonia" platform) | Same as in-person |
| Abruzzo | DGR 142/2023 | Teleconsulto | Coded as CUR 89.01 (follow-up visit) |

- Lombardy's DGR XII/3630 also lists remote control of implanted cardiac electronic devices among its telemedicine services. — [Assortopedia (DGR text)](https://www.assortopedia.it/normativa/atti-regionali/lombardia/323-dgr-2024-3630-del-16-12-2024-recepimento-nuovo-nomenclatore/file.html); [Netmedi](https://www.netmedi.care/it/news/dgr-regione-lombardia-per-ricomprendere-nel-nomenclatore-tariffario-prestazione-di-telemedicina/)
- Piemonte added to its nomenclatore the telemonitoring of patients with arrhythmia-diagnosis devices, pacemakers and similar devices. — [Regione Piemonte](https://www.regione.piemonte.it/web/temi/sanita/al-via-telecardiologia-monitoraggio-distanza-per-portatori-pacemaker); [Quotidiano Sanità](https://www.quotidianosanita.it/regioni-e-asl/telemedicina-disciplinato-il-monitoraggio-a-distanza-per-i-portatori-di-pace-maker/)
- Emilia-Romagna's regional nomenclatore: DGR 1775/2023 (effective 1 Jan 2024) and DGR 1059/2024. — [Regione Emilia-Romagna](https://salute.regione.emilia-romagna.it/normativa-e-documentazione/leggi-atti/regionali/delibere/nomenclatore)
- Sardinia's regional nomenclatore uses the average tariffs of Emilia-Romagna, Veneto, Bolzano, Lombardia and Toscana. — [Regione Sardegna](https://www.regione.sardegna.it/notizie/pubblicato-il-nomenclatore-tariffario-regionale-delle-prestazioni-di-assistenza-specialistica-ambulatoriale)

**Real-world programme costs and private prices (Italy)**
- ASL 3 Nuoro's HF telemonitoring programme costs about **€1,000 per patient**. The ASL reports a 48% reduction in HF admissions and about €900,000 in savings. These are observational, self-reported figures. — [ASL Nuoro](https://www.asl3nuoro.it/la-telemedicina-di-nuoro-nel-giornale-italiano-di-cardiologia/); [Agenda Digitale](https://www.agendadigitale.eu/sanita/telemedicina-per-gestire-la-cronicita-il-modello-asl-3-nuoro/)
- Private Holter ECG 24h: about €100–200 on average in Italy, and €110 for a home Holter including the cardiologist's report. — [Elty](https://elty.it/prenota-visita/holter-cardiaco-24-ore/castel-san-pietro-terme); [Medicilio](https://www.medicilio.it/servizi/cardiologia-a-domicilio/holter-cardiaco)
- Hardware reference: a 24h Holter ECG system (recorder plus software) sells for about €415 in retail. — [CFS](https://www.cfs.it/collections/diagnostica-elettrocardiografi-holter-ecg)

### Inferences
- An Italian business model can rest on several revenue streams: regional CIED telecontrol tariffs (about €23–26 per service), visit-equivalent tariffs for telemonitoring or televisita (about €18 in Lombardy and Lazio), PNRR- or regional-funded tenders (programme cost of about €1,000 per patient per year in one ASL example), and private pay (Holter €100–200). There is no national DRG-like payment for continuous telemonitoring.
- The SSN Holter tariff (€64.25) is far below US payment for extended patch monitoring (about $245–290; see Section 3). That limits the use of costly multi-day patches in SSN outpatient care unless a region adds a code or the hospital buys them under a tender or DRG.
- Since PNRR money ends in 2026, structural funding for the service is the main risk. Dose Digitale says so explicitly ("Una piattaforma viene finanziata una volta. Un servizio sanitario deve essere finanziato ogni giorno").

### Gaps
- I did not obtain primary regional DGR tables for Veneto, Emilia-Romagna, Lazio or Toscana showing tariffs for *non-device* cardiac telemonitoring (HF, hypertension), for example per month. Search snippets showed lines such as "con scompenso cardiaco €35,00 / €55,03" in Lazio and Emilia-Romagna nomenclatori ([ASL Roma 2](https://www.aslroma2.it/attachements/j4/com_content.article/DG1187-tariffario-specialistica-ambulatoriale.pdf); [Emilia-Romagna allegato](https://storagehub.homnya.net/cmsimage/allegati/allegato1699610995.pdf)), but the service descriptions could not be checked. Do not use them.
- No national code "89.48.x" for CIED remote control was found. ISS says the national nomenclatore does not include CIED remote control, so 89.48.x appears to be regional only, if it exists. Unconfirmed.
- The ISS report text links "DM 77/2022" to the DM of 29 April 2022 (digital home-care model). DM 77/2022 is in fact the DM of 23 May 2022 n. 77 on territorial care standards (Case della Comunità, COT). This comes from background knowledge and should be checked in the Gazzetta Ufficiale.
- The fpress article gives "21 settembre" as the date the tariffs came into force, which is unclear. The national nomenclatore came into force on 30 Dec 2024. Check which act fpress refers to (possibly a pharmacy-services agreement).
- I found no Italian public tender award with a per-patient-per-month telemonitoring fee, except the Nuoro programme cost. Searches on ANAC/TED data would be needed.
- I found no current national figure on how many patients are actually in *cardiological* telemonitoring under the PNRR.

## 3. USA: CMS reimbursement (RPM/RTM 2025–2027, ambulatory ECG), OIG oversight, FDA digital-health guidance

### Takeaway
For CY2026, CMS added CPT 99445 (2–15 days of data, paid the same as 99454) and 99470 (10–19 minutes of management). A standard month (99454 + 99457) pays about $104 in national average Medicare rates. The CY2027 final rule (4 Nov 2026) adds two requirements from 1 Jan 2027, a separately billable initiating visit and established-patient status for RTM, and revises practice-expense valuations. It delays the "clinical staff must be direct employees" rule to 1 Jan 2029. The OIG reports Medicare RPM spending grew from $15M (2019) to $536M (2024) with many questionable billing patterns. On the FDA side, the main recent documents are the final CDS guidance (29 Jan 2026), the final General Wellness guidance (6 Jan 2026) and a draft cuffless BP guidance (23 Jan 2026).

### Cited Findings
**RPM codes and 2026 national average Medicare payments**
- CMS finalised two new RPM codes for 2026, **99445** (device supply, 2–15 days of data per 30 days) and **99470** (first 10 minutes of treatment management), effective 1 Jan 2026. 99445 is paid at the same rate as 99454. 99470 and 99457 are mutually exclusive in the same month. — [Nsight Care](https://nsightcare.com/blog/new-rpm-cpt-codes-2026-guide-99445-99470-reimbursement/); [CCN Health](https://ccnhealth.com/articles/blog/rpm-reimbursement-changes-2026)
- 2026 national averages from billing vendors, with 2025 rates for comparison:

  | Code | 2026 | 2025 |
  |---|---|---|
  | 99453 (setup) | **$21.71** | — |
  | 99445 | **$52.11** | new code |
  | 99454 | **$52.11** | ~$43.02 |
  | 99470 | **$26.05** | new code |
  | 99457 | **$51.77** | ~$47.87 |
  | 99458 | **$41.42** | ~$38.19 |
  | 99091 | ~$58 | — |

  — [RPMLogix](https://rpmlogix.com/2026-reimbursement-rates/); [ThoroughCare](https://www.thoroughcare.net/blog/remote-patient-monitoring-billing-rules); [CCN Health](https://ccnhealth.com/articles/blog/rpm-reimbursement-changes-2026)
- **Discrepancies:**
  - Other vendors give 99454 and 99445 as about $47–48 (Tenovi $47, CGM $48, Prevounce $47.43 for 99445). — [Tenovi](https://www.tenovi.com/rpm-cpt-codes-2026/); [CGM](https://www.cgm.com/usa_en/magazine/articles/2026-medicare-rpm-code-changes-what-your-practice-is-leaving-on-the-table.html); [Prevounce](https://blog.prevounce.com/quick-guide-remote-patient-monitoring-rpm-cpt-codes-to-know)
  - 99091 is $55.45 on PayerPrice versus ~$58 on CCN Health. — [PayerPrice](https://payerprice.com/medicare-fee-schedule-lookup?codes=99091&medicareType=physician_ffs&state=national)
- Indicative monthly revenue per patient (2026 national averages, from a vendor):

  | Scenario | Codes | Monthly revenue |
  |---|---|---|
  | Minimum | 99445 + 99470 | ~$78 |
  | Standard | 99454 + 99457 | ~$104 |
  | Extended | 99454 + 99457 + 99458 | ~$145 |
  | Full | 99454 + 99457 + 99458×2 + 99091 | ~$245 |
  | First month | 99453 + 99454 + 99457 | ~$126 |

  — [CCN Health](https://ccnhealth.com/articles/blog/rpm-reimbursement-changes-2026)
- CY2026 PFS final rule: issued 31 Oct 2025, effective 1 Jan 2026. — [CMS fact sheet CMS-1832-F](https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2026-medicare-physician-fee-schedule-final-rule-cms-1832-f)
- CMS designated two new RTM codes (98984, 98985) as "sometimes therapy" for 2026. — [CMS MLN MM14250](https://www.cms.gov/files/document/mm14250-therapy-code-list-2026-annual-update.pdf)

**CY2027 PFS final rule (issued 4 Nov 2026; Federal Register 9 Nov 2026)**
- Finalised, effective 1 Jan 2027:
  1. RTM may be furnished only to established patients. RPM already had this rule.
  2. RPM and RTM require a **separately reportable initiating (face-to-face) visit** linked to the start of monitoring. There is no maximum interval, and RPM need not be the only purpose of the visit, but it must be discussed.
  3. Practice-expense revaluation of 99445, 99453, 99454, 98975, 98976, 98977, 98984 and 98985. CMS gave no detail on the resulting dollar effect.
  4. The requirement that RPM/RTM be performed only by clinical staff who are **direct employees** of the billing practice is finalised but **delayed to 1 Jan 2029**.
  5. The four HCPCS G-codes bundling RPM/RTM that CMS asked for comment on were **not adopted**.

  — [CMS CY2027 PFS final rule fact sheet](https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2027-medicare-physician-fee-schedule-final-rule); [Nixon Peabody, 9 Nov 2026](https://www.nixonpeabody.com/insights/alerts/2026/11/09/cms-finalizes-2027-medicare-rpm-rtm-changes-direct-employee-rule-delayed-to-2029); [Federal Register 2026-22743](https://www.federalregister.gov/documents/2026/11/09/2026-22743/medicare-and-medicaid-programs-cy-2027-payment-policies-under-the-physician-fee-schedule-and-other)
- CY2027 conversion factors: **$32.95** (qualifying APM) and **$32.63** (non-qualifying APM). — [CMS CY2027 fact sheet](https://www.cms.gov/newsroom/fact-sheets/calendar-year-cy-2027-medicare-physician-fee-schedule-final-rule)

**Ambulatory ECG, MCT and CIED remote interrogation: 2026 Medicare national, physician fee schedule**

| Code | Service | 2026 | 2025 |
|---|---|---|---|
| 93224 | Holter up to 48h | **$70.48** | — |
| 93241 | >48h–7 days, complete | **$279.23** | — |
| 93243 | >48h–7 days, scanning analysis | **$244.83** | — |
| 93245 | >7–15 days, complete | **$289.59** | — |
| 93247 | >7–15 days, scanning analysis | **$253.18** | $234.84 (+7.8%) |
| 93228 | MCT, professional | **$25.05** | — |
| 93229 | MCT, technical, up to 30 days | **$758.53** | $744.62 (+1.9%) |
| 99091 | Data interpretation | **$55.45** | — |
| 93297 / 93298 | CIED remote interrogation | Several component-level values ($24.38–$103.21); not reliable as single figures | — |

— [PayerPrice 2026 lookup](https://payerprice.com/medicare-fee-schedule-lookup?codes=93241,93243,93245,93247,93228,93229,93224,93297,93298,99091&medicareType=physician_ffs&state=national); [PayerPrice 93247](https://payerprice.com/medicare-fee-schedule-lookup?codes=93247&medicareType=physician_ffs&state=national); [PayerPrice 93229](https://payerprice.com/medicare-fee-schedule-lookup?codes=93229&medicareType=physician_ffs&state=national)

- The Zio monitor is billed under CPT 93243 for >48h–7 days, per iRhythm. — [iRhythm billing & reimbursement](https://www.irhythmtech.com/us/en/healthcare-professionals/billing-reimbursement)
- Older context: the national rate CMS first proposed for iRhythm's most-used code (Zio XT) was about $229, before national pricing replaced contractor pricing (2022–2023 era). — [XIFIN](https://www.xifin.com/billing-beat/cms-proposes-national-rates-cardiac-monitoring-irhythms-stock-jumps/); [Novitas 2022 contractor prices](https://www.novitas-solutions.com/webcenter/portal/MedicareJL/pagebyid?contentId=00258104)
- The 93224 Holter rate of $70.48 in 2026 is about 24% below its 2018 level ($92.88). — [107 RCM](https://oneosevenrcm.com/cpt-code-93224/)

**OIG oversight**
- Report OEI-02-23-00260 (Sept 2024):
  - Medicare RPM use "increased dramatically from 2019 to 2022".
  - About **43% of enrollees** receiving RPM did not receive all three components.
  - Medicare lacks key oversight data, such as who ordered the monitoring and what data are monitored.
  - Most enrollees were monitored for chronic conditions, most often hypertension.
  - Recommendations: more safeguards; require an order and the ordering-provider identity on claims; identify the data monitored; educate providers; identify and monitor companies that bill RPM.

  — [OIG report page](https://oig.hhs.gov/reports/all/2024/additional-oversight-of-remote-patient-monitoring-in-medicare-is-needed/); [OIG PDF](https://oig.hhs.gov/documents/evaluation/10001/OEI-02-23-00260.pdf)
- OIG data snapshot OEI-02-23-00261 (Aug 2025):
  - Medicare RPM payments by year: **$15M (2019), $82M (2020), $202M (2021), $311M (2022), $408M (2023), $536M (2024)**.
  - **Nearly 1 million** enrollees received RPM in 2024.
  - Questionable billing patterns:
    - 32 practices with sudden enrolment surges (one billed about 3,400 new enrollees in a month);
    - 45 practices with no prior relationship with more than 80% of their RPM patients (one with more than 30,000 such enrollees);
    - 52 practices where more than 75% of enrollees never had treatment management billed;
    - 34 practices often billing the same enrollees as two or more other practices;
    - about 20 practices often billing 2+ devices per month per enrollee.

  — [OIG Data Snapshot PDF](https://oig.hhs.gov/documents/evaluation/10901/OEI-02-23-00261.pdf)

**FDA guidance (digital health)**
- FDA's digital-health guidance list shows:
  - **Clinical Decision Support Software: final, issued 29 Jan 2026**;
  - **General Wellness: Policy for Low Risk Devices: final, issued 6 Jan 2026**;
  - an 18 Aug 2025 guidance titled "Marketing Submission Recommendations for a …" (title cut off in the search snippet; likely PCCP-related).

  — [FDA – Guidances with Digital Health Content](https://www.fda.gov/medical-devices/digital-health-center-excellence/guidances-digital-health-content); [FDA General Wellness guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices); [FDA CDS guidance PDF](https://www.fda.gov/media/109618/download)
- **Draft guidance on cuffless non-invasive BP devices (clinical performance testing), 23 Jan 2026.** — [Federal Register](https://www.federalregister.gov/documents/2026/01/23/2026-01288/cuffless-non-invasive-blood-pressure-measuring-devices-clinical-performance-testing-and-evaluation); [FDA page](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cuffless-non-invasive-blood-pressure-measuring-devices-clinical-performance-testing-and-evaluation)

### Inferences
- A US cardiology RPM programme typically earns about $78–145 per patient per month at Medicare national averages, before vendor fees. The 2026 codes make lower-intensity monitoring (2–15 days, 10 minutes) billable.
- From 2027, the initiating-visit rule and continued OIG scrutiny weaken the "turnkey vendor enrols patients" model. The direct-employee rule (2029) will force vendor contracts to be restructured. Any business plan relying on third-party nurse call centres billed "incident to" carries regulatory risk after 2028.
- Extended patch ECG (93241–93248) pays about $245–290 per study in 2026. MCT (93229 + 93228) pays about $780 per 30-day episode. These codes, not RPM codes, are the main reimbursement route for arrhythmia wearables.
- The 2027 conversion factor ($32.63/$32.95) means slight rate changes again in 2027. The exact 2027 per-code RPM amounts were not available.

### Gaps
- The primary CMS addenda (RVUs) for 99445/99470 and the CY2026 conversion factor were not opened. The 2026 dollar figures come from billing vendors, with the ~$5 discrepancy on 99454/99445 noted above.
- CY2027 per-code RPM payment amounts after the PE revaluation were not found.
- FDA PCCP guidance: I believe it was finalised in Dec 2024 for AI-enabled device software functions. Its exact 2025 status (the 18 Aug 2025 entry) was not checked. FDA's draft guidance on pulse-oximeter performance across skin pigmentation (believed Jan 2025) and the draft AI-enabled device software lifecycle guidance (Jan 2025) were not checked in this session.
- 93297/93298 (CIED remote interrogation) national amounts were not resolved clearly.

## 4. Indicative prices: devices and services

### Takeaway
Hard price data is scarce. Most published "prices" are payer tariffs.
- **US:** Medicare pays about $245–290 per extended patch-ECG study, about $780 per 30-day MCT episode and about $78–245 per patient-month for RPM. Cash Holter prices are $120–378.
- **Italy:** the SSN pays €64.25 for a Holter and about €23–26 per CIED remote check. Private Holter costs €100–200. One ASL telemonitoring programme reports about €1,000 per patient.

### Cited Findings
- US RPM monthly revenue at Medicare national averages: ~$78 (minimum), ~$104 (standard), ~$145, ~$245 (full), ~$126 (first month). — [CCN Health](https://ccnhealth.com/articles/blog/rpm-reimbursement-changes-2026)
- Another vendor gives a "maximum monthly RPM revenue" of about $181 (99454 at $47 + 99457 at $52 + 99458×2 at $82). — [Advanta Biometrics](https://www.advantabiometrics.com/connected-care-central/2026-remote-patient-monitoring-reimbursement-rates-all-rpm-cpt-codes-including-new-99445-and-99470)
- US extended ECG and MCT (Medicare 2026): 93241 $279.23, 93243 $244.83, 93245 $289.59, 93247 $253.18, 93229 $758.53 plus 93228 $25.05. — [PayerPrice](https://payerprice.com/medicare-fee-schedule-lookup?codes=93241,93243,93245,93247,93228,93229,93224,93297,93298,99091&medicareType=physician_ffs&state=national)
- US cash-price Holter monitoring: $120–$378. — [MDsave](https://www.mdsave.com/procedures/holter-monitoring/d783f8cc)
- iRhythm (Zio): 2024 revenue guidance $580–590M, mentioning average selling prices. — [Investing.com](https://www.investing.com/news/company-news/irhythm-launches-zio-monitor-service-in-europe-93CH-3593125)
- iRhythm 2025 revenue was estimated at about $694M by an analyst in a news report. — [Yahoo Finance](https://finance.yahoo.com/news/irhythm-shares-soar-fda-clears-125640489.html)
- Italy, SSN national tariffs: Holter ECG €64.25, ABPM 24h €42.85, ECG €12.05. — [Fpress](https://www.fpress.it/filiera/in-vigore-il-nuovo-nomenclatore-cosa-cambia-per-la-telecardiologia-in-farmacia/)
- Italy, regional CIED telecontrol: €23.20–€25.55 per service. — [ISS Rapporti ISTISAN 25/16](https://www.iss.it/documents/20126/9975143/25-16+web.pdf/24e67c50-1206-3197-341e-48f7f0718405?t=1763379477314)
- Italy, ASL Nuoro HF telemonitoring: about €1,000 per patient. — [ASL Nuoro](https://www.asl3nuoro.it/la-telemedicina-di-nuoro-nel-giornale-italiano-di-cardiologia/)
- Italy, private Holter 24h: €100–200 on average, €110 at home including report. — [Elty](https://elty.it/prenota-visita/holter-cardiaco-24-ore/castel-san-pietro-terme); [Medicilio](https://www.medicilio.it/servizi/cardiologia-a-domicilio/holter-cardiaco)
- Italy, Holter recorder plus software hardware: about €415. — [CFS](https://www.cfs.it/collections/diagnostica-elettrocardiografi-holter-ecg)

### Inferences
- In the US, reimbursement levels effectively set the "service price" for patch ECG and MCT. Vendors such as iRhythm bill payers directly as an independent diagnostic testing facility (IDTF) service, so a physician practice usually does not buy the device. In Italy, the same service would have to be bought by the hospital or ASL, or paid privately, because the SSN Holter tariff (€64.25) cannot cover a multi-day patch.

### Gaps
- No verified per-day cost of multiparametric wearable patches (e.g., vendor list prices per day or per kit) was found.
- No verified US monthly RPM kit or vendor platform fee (per patient per month charged to practices) was found.
- No Zio self-pay price was found. iRhythm does not publish one; the per-test average selling price is not disclosed in the sources reviewed.
- No Italian tender award prices per patient per month for telemonitoring were found.

## 5. Market size and growth (RPM / wearable cardiac monitoring)

### Takeaway
Market estimates differ by up to tenfold depending on how the market is defined: devices plus services versus software/services only versus "RPM" narrowly. For 2025–2026 they range from about $6.9B to about $71B globally. Treat them as directional only. Hard anchors are Medicare RPM spending ($536M in 2024) and iRhythm revenue (about $580–694M).

### Cited Findings
- **Fortune Business Insights, RPM devices** (devices plus services):
  - $59.92B in 2025, $71.29B in 2026, $289.77B by 2034 (CAGR 19.16%, 2026–2034);
  - North America 48.06% share;
  - services 64.18%;
  - cardiovascular disease is the largest application at 47.27% (2026).

  — [Fortune Business Insights](https://www.fortunebusinessinsights.com/remote-patient-monitoring-devices-market-106328)
- **Fortune Business Insights, remote healthcare**: $85.32B (2025) to $496.44B (2034), CAGR 21.61%; RPM is about 42% of it. — [Fortune Business Insights](https://www.fortunebusinessinsights.com/remote-healthcare-market-117163)
- **MarketsandMarkets, global RPM**: about $36.32B (2026) to about $66.33B (2031), CAGR 12.8%; devices are the largest component.
  - The US RPM page of the same report says "$1,641M in 2026 → $2,594.1M by 2031 (CAGR 12.5%)".
  - Yet its own US end-user table totals $18,541.7M for 2026, an **internal inconsistency**.

  — [MarketsandMarkets US RPM](https://www.marketsandmarkets.com/Market-Reports/geography/remote-patient-monitoring-market/US)
- **Another MarketsandMarkets report** gives RPM at $6.16B (2024) and $6.87B (2025). — [MarketsandMarkets](https://www.marketsandmarkets.com/Market-Reports/remote-patient-monitoring-rpm-market-152898.html)
- **Grand View Research, RPM software and services**: snippet says "$4.7B in 2025, to grow from $19.6B in 2026 to $150.1B in 2033, CAGR 34.9%". The jump from 2025 to 2026 looks inconsistent. — [Grand View Research](https://www.grandviewresearch.com/industry-analysis/remote-patient-monitoring-software-services-market-report)
- **Grand View Research, AI in RPM**: $1.99B (2024) to $8.51B (2030), CAGR 27.98%; North America 50.66%. — [Grand View Research](https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-remote-patient-monitoring-market)
- GlobalMed cites an RPM devices market of $26.0B (2025) alongside the $59.92B devices-plus-services figure. — [GlobalMed](https://www.globalmed.com/resources/remote-patient-monitoring-devices-market)
- Hard spending anchor: Medicare RPM payments were $536M in 2024, for nearly 1 million enrollees. — [OIG](https://oig.hhs.gov/documents/evaluation/10901/OEI-02-23-00261.pdf)

### Inferences
- The gap between about $7B and about $60–71B mostly reflects definitions. Some reports include all connected devices (glucose meters, BP cuffs, CIED remote monitoring, consumer wearables) and services; others count only RPM software/services. Medicare fee-for-service RPM spending of about $0.5B a year shows that the reimbursed US physician-billed RPM market is much smaller than headline figures.
- Growth estimates (12–35% CAGR) are consistently positive but vary widely. Use the lower end (about 12–13%, MarketsandMarkets) for conservative planning.

### Gaps
- I found no specific, sourced 2025–2026 market size for *wearable cardiac monitoring / ambulatory ECG* (e.g., Grand View "wearable ECG monitors" or "cardiac monitoring devices") in this session.
- I found no IQVIA or Italy/EU-specific telemonitoring market size.

## 6. Evidence of clinical benefit and guideline recommendations

### Takeaway
- **Heart failure:** structured non-invasive telemonitoring has mixed but net-positive evidence. TIM-HF2 showed about 30% lower all-cause mortality, and the 2021 ESC HF guideline gives it IIb B. The 2026 ESC HF guidelines (28 Aug 2026) exist, but their telemonitoring wording was not checked.
- **Hypertension:** self-monitoring plus telemonitoring lowers BP by about 4–5 mmHg (TASMINH4), and the 2023 ESH guideline gives telehealth Class I.
- **AF screening:** screening finds more AF (LOOP tripled detection), but LOOP did not show a significant stroke reduction.

### Cited Findings
**Heart failure**
- 2021 ESC HF guidelines: "Non-invasive HTM [home telemonitoring] may be considered for patients with HF in order to reduce the risk of recurrent CV and HF hospitalizations and CV death" — **Class IIb, Level B**. — [2021 ESC HF Guidelines (EHJ PDF hosted by Abbott)](https://www.cardiovascular.abbott/content/dam/cv/cardiovascular/hcp/products/structural-heart/mitraclip/documents/sh-mitraclip-ehj-2021-esc-guidelines-heart-failure.pdf); [PMC review 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12127967/)
- An ESC e-Journal article says a Class IIb recommendation for *invasive* telemonitoring (implantable haemodynamic sensors) was established in ESC HF guidance. — [ESC e-Journal](https://www.escardio.org/communities/councils/cardiology-practice/scientific-documents-and-publications/ejournal/volume-18/e-health-in-cardiology-remote-patient-management-of-heart-failure-patients/)
- **2026 ESC Guidelines for the management of heart failure** were published on 28 Aug 2026. They introduce a stage-based classification and a revised therapy nomenclature. The telemonitoring recommendation was not on the landing page. — [ESC](https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/heart-failure/)
- TIM-HF2 (non-invasive home monitoring with a 24/7 telemedical centre): 30% reduction in all-cause mortality over 12–13 months. — [MDedge](https://www.mdedge.com/cardiology/article/176009/heart-failure/home-telemonitoring-heart-failure-cuts-mortality)
- Meta-analyses:
  - mHealth interventions with remote monitoring and clinical feedback reduce mortality and HF hospitalisations but might not reduce all-cause hospitalisation (Kitsiou 2021). — [Can J Cardiol 2021](https://onlinecjc.ca/article/S0828-282X(21)00118-5/abstract)
  - A 2026 preprint meta-analysis with trial sequential analysis reports consistent reductions in all-cause mortality with RPM in HF. It is **not peer-reviewed**. — [medRxiv 2026](https://www.medrxiv.org/content/10.64898/2026.02.25.26347143v3)
  - A Cureus systematic review concludes that telemonitoring "may help reduce hospitalization rates in selected patients", with uncertain mortality effects. — [Cureus](https://www.cureus.com/articles/493045-impact-of-telemonitoring-on-hospitalization-and-mortality-among-patients-with-heart-failure-a-systematic-review-of-randomized-controlled-trials)
- Italian real-world data: ASL Nuoro reports a 48% reduction in HF hospitalisations with telemonitoring (observational). — [Agenda Digitale](https://www.agendadigitale.eu/sanita/telemedicina-per-gestire-la-cronicita-il-modello-asl-3-nuoro/)

**Hypertension**
- TASMINH4 (Lancet 2018; 1,182 patients; 142 UK practices). At 12 months, systolic BP was lower than usual care with self-monitoring (−3.5 mmHg, 95% CI −5.8 to −1.2) and with telemonitoring (**−4.7 mmHg**, 95% CI −7.0 to −2.4). There was no significant difference between the two. — [PubMed 29499873](https://pubmed.ncbi.nlm.nih.gov/29499873/)
- The 2024 ESC guidelines on elevated BP and hypertension (30 Aug 2024) include a recommendation table on self-measuring and monitoring BP (Recommendation Table 35). They cite HOME BP (BMJ 2021) and US telemedicine meta-analyses. — [ESC 2024 hypertension guideline PDF](https://www.cardioaragon.com/wp-content/uploads/2024-ESC-Guidelines-for-the-management-of-hypertension.EHeartJ.2024_.pdf); [ESC page](https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/elevated-blood-pressure-and-hypertension/)
- The 2023 ESH guideline recommends novel telehealth technologies and virtual care to improve BP management (Class I). — [PMC comparison of guidelines](https://pmc.ncbi.nlm.nih.gov/articles/PMC12011322/)

**AF detection**
- LOOP study (Lancet 2021): implantable loop recorder screening of at-risk individuals produced a "three-times increase in atrial fibrillation detection and anticoagulation initiation but no significant reduction" in stroke or systemic arterial embolism. — [PubMed 34469766](https://pubmed.ncbi.nlm.nih.gov/34469766/); [ACC summary](https://www.acc.org/latest-in-cardiology/clinical-trials/2021/08/28/01/38/loop)
- Apple Heart Study (NEJM 2019): 419,297 participants; 0.52% received irregular-pulse notifications; 34% of those who returned an ECG patch had AF on it. Source is a secondary summary. — [Mima Health summary](https://www.mima.health/en/evolution/discoveries/smartwatch-atrial-fibrillation-study)
- A health-economic analysis of AF screening with Zio patches used patient-level mSToPS data (AHA 2022). — [iRhythm investor release](https://investors.irhythmtech.com/news/news-details/2022/Results-of-Four-Studies-Demonstrating-Clinical-Economic-Value-of-iRhythms-Product-Portfolio-Presented-at-American-Heart-Association-22/default.aspx)

### Inferences
- For a cardiologist judging products:
  - **HF:** benefit appears with *structured* programmes (daily multiparameter data, a 24/7 response centre, defined escalation as in TIM-HF2), not with passive data collection. This fits the Italian AGENAS emphasis on alert response times and a responsibility matrix.
  - **Hypertension:** the effect comes mostly from self-monitoring plus medication titration. Telemonitoring adds logistics and efficiency rather than large extra BP lowering.
  - **AF:** detection gains are robust, but hard-outcome benefit (stroke) is not proven for screening, which matters for consumer-wearable business models.

### Gaps
- The telemonitoring and remote-monitoring recommendation classes in the **2026 ESC HF guidelines** were not checked. This needs to be done, as it may supersede the 2021 IIb B.
- The following figures come from background knowledge and were not re-checked in this session:
  - TIM-HF2 primary endpoint: percentage of days lost to unplanned CV hospitalisation or all-cause death, 4.88% vs 6.64%; all-cause mortality HR about 0.70.
  - BEAT-HF (JAMA Intern Med 2016): no significant reduction in 180-day readmission.
  - Tele-HF (NEJM 2010): no reduction in readmission or death.
  - HOME BP (BMJ 2021): about −3.4 mmHg systolic.
  - mSToPS (JAMA 2018): new AF diagnosis about 3.9% vs 0.9% at 4 months with patch monitoring.

  Check them against PubMed before citing.
- ESC 2024 AF guideline recommendations on screening with wearables and on CIED remote monitoring (HRS 2023 expert consensus, Class I for remote monitoring of CIEDs) were not checked.
- I did not research evidence for post-discharge monitoring or hospital-at-home in cardiology in this session.
