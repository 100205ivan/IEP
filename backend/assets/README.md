# IEP PDF reference

`iep-reference.pdf` is derived from the user-supplied `(葉瓊華教授)1140323個別化教育計畫-參考格式.pdf` (114.03.23, 20 A4 pages). Its tables, colors, headings and reference pages are retained. Sample answers on pages 13–14 and discussion prompts on pages 19–20 have been removed from the text streams before distribution; they are not student data. `iep-reference-layout.json` contains checkbox positions extracted from the original.

The exporter fills these vector pages, adds copies for additional goal domains and meetings, and inserts complete text continuations directly after each section where needed. Page numbers are regenerated. Signatures are never generated.

The cover team table is redrawn within its original footprint with wider name columns, centered 11-point names and a continuous grid. Long or multiple names continue in full on the following page instead of shrinking below a readable size. The original role groups, color cues and empty signature cells are retained.

The source-format heading and byline at the top of the cover have been removed from the template text stream for student exports. The original source attribution is retained in this documentation.

Set `IEP_PDF_FONT_PATH` to an embeddable Traditional Chinese TTF/OTF on the backend host. On Windows the default is `%SystemRoot%/Fonts/kaiu.ttf` (標楷體). Font files are not included in the repository. The process must be restarted after changing the font setting.

Cover fields, team names and the default legacy timetable semester are saved per IEP in `ieps.content.pdfExportOptions` through the regular Save IEP action. Legacy IEPs without settings open with blank/default values. Exporting does not write data; an export request may explicitly override the saved options for its preview. Timetable entries carry their own semester, and both semesters (including eighth periods) are exported together. Legacy entries inherit the saved default semester before editing. Missing source fields stay blank; hidden inactive drafts are excluded. Reference explanation pages 12 and 16 remain included.


`reference-form-options.json` defines the source form categories and row geometry. Keep it identical to `frontend/src/models/referenceFormOptions.json`; the reference-form test checks synchronization. Added chapter fields are optional extensions, so old records remain readable without synthesizing a no-need decision. Exact source support choices, per-item notes, fusion plans, per-subject adjustments, independent course placements/dates, subskill impacts, strategy execution records and transition employment details are validated before saving. Source terms with different meanings are not inferred from generic legacy choices; unmatched content goes into the section continuation.

Certificate front/back PNG or JPEG images are stored per IEP in `iep_attachments` (migration `008_iep_attachments`). Uploads persist immediately, independently from Save IEP; team names and chapter fields use Save IEP. Images are limited to 5 MiB and 25 million pixels, validated before replacing the previous image, and looked up through the student's own IEP. Deleting an IEP cascades to its images. Export only reads them and embeds them into the original page 3 attachment boxes. Signatures remain blank for paper signing.

Validation: run `npx tsx --test src/tests/*.test.ts` from `backend`, and `npm run build` / `npm run lint` from `frontend`. The tests cover compatibility, schema rejection, two semesters, long-text preservation, certificate content validation and actual PDF output text/images. Test-only PDFs, student records and certificate samples belong outside the Git repository.
