# IEP PDF reference

`iep-reference.pdf` is derived from the user-supplied `(葉瓊華教授)1140323個別化教育計畫-參考格式.pdf` (114.03.23, 20 A4 pages). Its tables, colors, headings and reference pages are retained. Sample answers on pages 13–14 and discussion prompts on pages 19–20 have been removed from the text streams before distribution; they are not student data. `iep-reference-layout.json` contains checkbox positions extracted from the original.

The exporter fills these vector pages, adds copies for additional goal domains and meetings, and inserts complete text continuations directly after each section where needed. Page numbers are regenerated. Signatures are never generated.

Set `IEP_PDF_FONT_PATH` to an embeddable Traditional Chinese TTF/OTF on the backend host. On Windows the default is `%SystemRoot%/Fonts/kaiu.ttf` (標楷體). Font files are not included in the repository. The process must be restarted after changing the font setting.

Cover fields and the timetable semester are saved per IEP in `ieps.content.pdfExportOptions` through the regular Save IEP action. Legacy IEPs without settings open with blank/default values. Exporting does not write data; an export request may explicitly override the saved options for its preview. One system timetable is placed in the selected semester. Missing source fields stay blank; hidden inactive drafts are excluded. Reference explanation pages 12 and 16 remain included.
