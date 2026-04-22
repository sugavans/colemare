/**
 * docxGenerator.js
 * Generates formatted .docx files using the docx npm package.
 * Handles both the optimised resume and the match analysis report.
 */

import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, convertInchesToTwip,
} from 'docx';

// ─── Colour Constants ────────────────────────────────────────────────────────
const NAVY = '1F3864';
const BLUE = '2E5DA6';
const SUCCESS = '27AE60';
const WARNING = 'F39C12';
const DANGER = 'E74C3C';
const LIGHT_GREY = 'F0F2F7';
const DARK_GREY = '444444';
const WHITE = 'FFFFFF';

// ─── Helper: section heading (single paragraph with bottom border — no gap) ──
function sectionHeading(text) {
  return [
    new Paragraph({
      children: [
        new TextRun({
          text: text.toUpperCase(),
          bold: true,
          color: NAVY,
          size: 22,
          font: 'Calibri',
        }),
      ],
      // Bottom border acts as the horizontal rule — no separate empty paragraph needed
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 },
      },
      spacing: { before: 240, after: 80 },
    }),
  ];
}

// ─── Helper: bullet paragraph ────────────────────────────────────────────────
function bulletParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Calibri', color: DARK_GREY })],
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

// ─── Helper: sanitise contact block ─────────────────────────────────────────
// Ensures name and email/phone are separated by " | " even if AI omits it.
function sanitiseContact(contact) {
  return (contact || '').trim();
}

// ─── Helper: strip em-dashes from text ───────────────────────────────────────
function stripEmDashes(text) {
  return (text || '').replace(/—/g, ',').replace(/–/g, '-');
}

// ─── Section name normalisation map ──────────────────────────────────────────
const SECTION_NAME_MAP = {
  'certifications':              'CERTIFICATIONS',
  'certifications & licences':   'CERTIFICATIONS',
  'certifications and licences': 'CERTIFICATIONS',
  'licenses':                    'CERTIFICATIONS',
  'achievements':                'ACHIEVEMENTS AND AWARDS',
  'achievements & awards':       'ACHIEVEMENTS AND AWARDS',
  'achievements and awards':     'ACHIEVEMENTS AND AWARDS',
  'publications':                'PUBLICATIONS AND PRESENTATIONS',
  'publications & presentations':'PUBLICATIONS AND PRESENTATIONS',
  'publications and presentations':'PUBLICATIONS AND PRESENTATIONS',
  'volunteer':                   'VOLUNTEER AND COMMUNITY',
  'volunteer work & community':  'VOLUNTEER AND COMMUNITY',
  'volunteer work and community':'VOLUNTEER AND COMMUNITY',
  'volunteer and community':     'VOLUNTEER AND COMMUNITY',
  'languages':                   'LANGUAGES',
  'education':                   'EDUCATION',
};
function normaliseSectionName(raw) {
  const key = (raw || '').toLowerCase().trim();
  return SECTION_NAME_MAP[key] || raw.toUpperCase();
}

// ─── Generate Resume .docx ───────────────────────────────────────────────────
export async function generateResumeDocx(headers, experience, addedSections = {}) {
  const children = [];

  // ── Name / Title Header
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: headers.optimisedTitle || 'Professional',
          bold: true,
          color: NAVY,
          size: 36,
          font: 'Palatino Linotype',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  // ── Contact Block
  if (headers.contact) {
    const contactText = sanitiseContact(headers.contact);
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactText,
            size: 18,
            font: 'Calibri',
            color: DARK_GREY,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      })
    );
  }

  // ── Professional Summary
  children.push(...sectionHeading('Professional Summary'));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: headers.summary || '',
          size: 20,
          font: 'Calibri',
          color: DARK_GREY,
        }),
      ],
      spacing: { after: 200, line: 276 },
    })
  );

  // ── Skills
  if (headers.skills && headers.skills.length > 0) {
    children.push(...sectionHeading('Skills / Core Competencies'));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: headers.skills.join(' | '),
            size: 20,
            font: 'Calibri',
            color: DARK_GREY,
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  // ── Tools
  if (headers.tools && headers.tools.length > 0) {
    children.push(...sectionHeading('Tools & Technologies'));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: headers.tools.join(' | '),
            size: 20,
            font: 'Calibri',
            color: DARK_GREY,
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  // ── Work Experience
  if (experience && experience.length > 0) {
    children.push(...sectionHeading('Work Experience'));

    for (const job of experience) {
      // Company name + dates
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: job.company || '',
              bold: true,
              color: NAVY,
              size: 22,
              font: 'Calibri',
            }),
            new TextRun({
              text: `  ${job.startDate || ''} – ${job.endDate || ''}`,
              size: 20,
              font: 'Calibri',
              color: DARK_GREY,
            }),
          ],
          spacing: { before: 160, after: 40 },
        })
      );

      // Company description
      if (job.companyDescription) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: job.companyDescription,
                italics: true,
                size: 18,
                font: 'Calibri',
                color: DARK_GREY,
              }),
            ],
            spacing: { after: 40 },
          })
        );
      }

      // Role title
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: job.roleTitle || '',
              bold: true,
              italics: true,
              size: 20,
              font: 'Calibri',
              color: BLUE,
            }),
          ],
          spacing: { after: 60 },
        })
      );

      // Role summary
      if (job.roleSummary) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: job.roleSummary,
                size: 19,
                font: 'Calibri',
                color: DARK_GREY,
              }),
            ],
            spacing: { after: 80 },
          })
        );
      }

      // Bullets
      for (const bullet of (job.bullets || [])) {
        children.push(bulletParagraph(bullet));
      }
    }
  }

  // ── Additional / User-Added Sections
  if (headers.additionalSections) {
    for (const [section, content] of Object.entries(headers.additionalSections)) {
      if (content && content.trim()) {
        const headingText = normaliseSectionName(section);
        const cleanContent = stripEmDashes(content);
        children.push(...sectionHeading(headingText));
        children.push(
          new Paragraph({
            children: [new TextRun({ text: cleanContent, size: 20, font: 'Calibri', color: DARK_GREY })],
            spacing: { after: 200 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ─── Generate Analysis .docx ─────────────────────────────────────────────────
export async function generateAnalysisDocx(analysis, companyName, jobTitle, sectionsWereAdded) {
  const children = [];

  // ── Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Resume Match Analysis',
          bold: true,
          color: NAVY,
          size: 36,
          font: 'Palatino Linotype',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${companyName || 'Company'} — ${jobTitle || 'Role'}`,
          size: 22,
          font: 'Calibri',
          color: BLUE,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
    })
  );

  // ── Overall Score Banner
  const score = analysis.overallScore || 0;
  const scoreColor = score >= 80 ? SUCCESS : score >= 60 ? WARNING : DANGER;

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Overall Match Score: ${score}%`,
          bold: true,
          color: scoreColor,
          size: 28,
          font: 'Calibri',
        }),
        new TextRun({
          text: `  (${analysis.requirementsAnalysed || 0} requirements analysed)`,
          size: 20,
          font: 'Calibri',
          color: DARK_GREY,
        }),
      ],
      spacing: { after: 160 },
    })
  );

  // ── Sections Added Note
  if (sectionsWereAdded) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '⚠ Note: Some sections were missing from your original resume. Match scores reflect the resume after your additions.',
            size: 18,
            font: 'Calibri',
            color: WARNING,
          }),
        ],
        spacing: { after: 240 },
      })
    );
  }

  // ── Top Strengths
  if (analysis.strengths && analysis.strengths.length > 0) {
    children.push(...sectionHeading('Top Strengths'));
    for (const strength of analysis.strengths) {
      children.push(bulletParagraph(strength));
    }
  }

  // ── ATS Keyword Audit (before requirements table)
  if (analysis.atsKeywords && (analysis.atsKeywords.present?.length || analysis.atsKeywords.missing?.length)) {
    children.push(...sectionHeading('ATS Keyword Audit'));

    if (analysis.atsKeywords.present?.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: '✅  Keywords present in resume', bold: true, color: SUCCESS, font: 'Calibri', size: 18 })],
        spacing: { before: 80, after: 60 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: analysis.atsKeywords.present.join('  ·  '), font: 'Calibri', size: 17, color: DARK_GREY })],
        spacing: { after: 160 },
      }));
    }

    if (analysis.atsKeywords.missing?.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: '❌  Keywords missing from resume', bold: true, color: DANGER, font: 'Calibri', size: 18 })],
        spacing: { before: 80, after: 60 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: analysis.atsKeywords.missing.join('  ·  '), font: 'Calibri', size: 17, color: DARK_GREY })],
        spacing: { after: 200 },
      }));
    }
  }

  // ── Gap Action Plan (before requirements table)
  if (analysis.gapActionPlan && analysis.gapActionPlan.length > 0) {
    children.push(...sectionHeading('Gap Action Plan'));

    for (const item of analysis.gapActionPlan) {
      const dispColor = item.disposition === 'OMIT' ? DANGER : WARNING;
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `[${item.disposition || 'REVIEW'}]  `, bold: true, color: dispColor, font: 'Calibri', size: 18 }),
          new TextRun({ text: item.item || '', bold: true, font: 'Calibri', size: 18, color: DARK_GREY }),
        ],
        spacing: { before: 120, after: 40 },
        border: { left: { style: BorderStyle.THICK, size: 16, color: dispColor, space: 8 } },
        indent: { left: 180 },
      }));
      if (item.interviewPrep) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Interview prep: ${item.interviewPrep}`, font: 'Calibri', size: 17, color: DARK_GREY, italics: true })],
          spacing: { after: 160 },
          indent: { left: 180 },
        }));
      }
    }
  }

  // ── Requirements Table
  children.push(...sectionHeading('Requirements Analysis'));

  if (analysis.requirements && analysis.requirements.length > 0) {
    // Page width: 8.5" - 2x1" margins = 6.5" = 9360 twips
    // Explicit DXA column widths so Word renders them correctly (not squished)
    const COL = { req: 2000, score: 600, status: 700, disposition: 900, covered: 2400, suggestion: 2760 };

    const cellOpts = (width, shading) => ({
      width: { size: width, type: WidthType.DXA },
      shading,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    });

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ ...cellOpts(COL.req,        { type: ShadingType.SOLID, color: NAVY }), children: [new Paragraph({ children: [new TextRun({ text: 'Requirement', bold: true, color: WHITE, font: 'Calibri', size: 18 })] })] }),
        new TableCell({ ...cellOpts(COL.score,      { type: ShadingType.SOLID, color: NAVY }), children: [new Paragraph({ children: [new TextRun({ text: 'Score',       bold: true, color: WHITE, font: 'Calibri', size: 18 })] })] }),
        new TableCell({ ...cellOpts(COL.status,     { type: ShadingType.SOLID, color: NAVY }), children: [new Paragraph({ children: [new TextRun({ text: 'Status',      bold: true, color: WHITE, font: 'Calibri', size: 18 })] })] }),
        new TableCell({ ...cellOpts(COL.disposition,{ type: ShadingType.SOLID, color: NAVY }), children: [new Paragraph({ children: [new TextRun({ text: 'Action',      bold: true, color: WHITE, font: 'Calibri', size: 18 })] })] }),
        new TableCell({ ...cellOpts(COL.covered,    { type: ShadingType.SOLID, color: NAVY }), children: [new Paragraph({ children: [new TextRun({ text: 'Covered By',  bold: true, color: WHITE, font: 'Calibri', size: 18 })] })] }),
        new TableCell({ ...cellOpts(COL.suggestion, { type: ShadingType.SOLID, color: NAVY }), children: [new Paragraph({ children: [new TextRun({ text: 'Suggestion',  bold: true, color: WHITE, font: 'Calibri', size: 18 })] })] }),
      ],
    });

    const dataRows = analysis.requirements.map((req, idx) => {
      const isEven      = idx % 2 === 0;
      const statusColor = req.status === 'STRONG' ? SUCCESS : req.status === 'PARTIAL' ? WARNING : DANGER;
      const rowShading  = { type: ShadingType.SOLID, color: isEven ? LIGHT_GREY : WHITE };

      return new TableRow({
        children: [
          new TableCell({ ...cellOpts(COL.req,         rowShading), children: [new Paragraph({ children: [new TextRun({ text: req.name          || '', font: 'Calibri', size: 18, color: DARK_GREY })] })] }),
          new TableCell({ ...cellOpts(COL.score,       rowShading), children: [new Paragraph({ children: [new TextRun({ text: `${req.score || 0}%`,    bold: true, color: statusColor, font: 'Calibri', size: 18 })] })] }),
          new TableCell({ ...cellOpts(COL.status,      rowShading), children: [new Paragraph({ children: [new TextRun({ text: req.status         || '', bold: true, color: statusColor, font: 'Calibri', size: 18 })] })] }),
          new TableCell({ ...cellOpts(COL.disposition, rowShading), children: [new Paragraph({ children: [new TextRun({ text: (req.disposition || '').replace(/_/g, ' '), font: 'Calibri', size: 16, color: DARK_GREY })] })] }),
          new TableCell({ ...cellOpts(COL.covered,     rowShading), children: [new Paragraph({ children: [new TextRun({ text: req.coveredBy     || '', font: 'Calibri', size: 17, color: DARK_GREY })] })] }),
          new TableCell({ ...cellOpts(COL.suggestion,  rowShading), children: [new Paragraph({ children: [new TextRun({ text: req.suggestion    || '', font: 'Calibri', size: 17, color: DARK_GREY })] })] }),
        ],
      });
    });

    children.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [COL.req, COL.score, COL.status, COL.disposition, COL.covered, COL.suggestion],
      })
    );
  }

  // ── Skill Gaps
  if (analysis.gaps && analysis.gaps.length > 0) {
    children.push(...sectionHeading('Skill Gaps & Recommendations'));

    for (const gap of analysis.gaps) {
      const priorityColor = gap.priority === 'HIGH' ? DANGER : gap.priority === 'MEDIUM' ? WARNING : '888888';
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${gap.priority}]  `, bold: true, color: priorityColor, font: 'Calibri', size: 18 }),
            new TextRun({ text: gap.description || '', bold: true, font: 'Calibri', size: 18, color: DARK_GREY }),
          ],
          spacing: { before: 120, after: 40 },
          border: {
            left: {
              style: BorderStyle.THICK,
              size: 16,
              color: priorityColor,
              space: 8,
            },
          },
          indent: { left: 180 },
        })
      );
      if (gap.suggestion) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Suggestion: ${gap.suggestion}`, font: 'Calibri', size: 17, color: DARK_GREY }),
            ],
            spacing: { after: 160 },
            indent: { left: 180 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ─── Generate Cover Letter .docx ─────────────────────────────────────────────
export async function generateCoverLetterDocx(coverLetterText, companyName, jobTitle) {
  const children = [];

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Cover Letter', bold: true, color: NAVY, size: 32, font: 'Palatino Linotype' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    })
  );

  // Sub-line
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `${jobTitle || 'Position'} — ${companyName || 'Company'}`, size: 20, font: 'Calibri', color: BLUE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Body — split on newlines, detect markdown bullets
  const lines = (coverLetterText || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Detect "- **bold text**" or "- **bold** rest" bullet pattern
    const boldBulletMatch = trimmed.match(/^-\s+\*\*(.+?)\*\*(.*)$/);
    // Detect plain "- text" bullet
    const plainBulletMatch = !boldBulletMatch && trimmed.match(/^-\s+(.+)$/);

    if (boldBulletMatch) {
      const boldPart = boldBulletMatch[1].trim();
      const restPart = boldBulletMatch[2].trim();
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 100 },
        children: [
          new TextRun({ text: boldPart, bold: true, size: 22, font: 'Calibri', color: DARK_GREY }),
          ...(restPart ? [new TextRun({ text: ' ' + restPart, size: 22, font: 'Calibri', color: DARK_GREY })] : []),
        ],
      }));
    } else if (plainBulletMatch) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 100 },
        children: [new TextRun({ text: plainBulletMatch[1], size: 22, font: 'Calibri', color: DARK_GREY })],
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22, font: 'Calibri', color: DARK_GREY })],
        spacing: { after: trimmed === '' ? 80 : 160, line: 288 },
      }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top:    convertInchesToTwip(1.25),
            right:  convertInchesToTwip(1.25),
            bottom: convertInchesToTwip(1.25),
            left:   convertInchesToTwip(1.25),
          },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
