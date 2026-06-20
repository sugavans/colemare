/**
 * docxGenerator.js
 * Generates formatted .docx files using the docx npm package.
 * Handles both the optimized resume and the score & analytics report.
 */

import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, convertInchesToTwip,
} from 'docx';

// ─── Color Constants ──────────────────────────────────────────────────────────
const NAVY = '1F3864';
const BLUE = '2E5DA6';
const SUCCESS = '27AE60';
const WARNING = 'F39C12';
const DANGER = 'E74C3C';
const LIGHT_GREY = 'F0F2F7';
const DARK_GREY = '444444';
const WHITE = 'FFFFFF';

// ─── Helper: score → color (used for overall score, requirements, bars) ───────
function colorForScore(score) {
  return score >= 80 ? SUCCESS : score >= 60 ? WARNING : DANGER;
}

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

// ─── Helper: pipe-separated list section (skills, tools, keywords) ───────────
function addListSection(children, title, items) {
  children.push(...sectionHeading(title));
  children.push(new Paragraph({
    children: [new TextRun({ text: items.join(' | '), size: 20, font: 'Calibri', color: DARK_GREY })],
    spacing: { after: 200 },
  }));
}

// ─── Helper: bullet paragraph ────────────────────────────────────────────────
function bulletParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Calibri', color: DARK_GREY })],
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

// ─── Helper: strip em-dashes from text ───────────────────────────────────────
function stripEmDashes(text) {
  return (text || '').replace(/—/g, ',').replace(/–/g, '-');
}

// ─── Section name normalization map ───────────────────────────────────────────
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

// ─── Helper: render a preserved section into docx children ───────────────────
// Returns a non-empty display name for a preserved section.
// Falls back to a type-appropriate label when the AI returns null / empty.
function preservedSectionName(section) {
  if (section.name && section.name.trim()) return section.name.trim();
  switch (section.type) {
    case 'bullets':             return 'Accomplishments';
    case 'verbatim':            return 'Recommendations';
    case 'functional_clusters': return 'Work Experience';
    case 'text':
    default:                    return 'Additional Information';
  }
}

function renderPreservedSection(section, children) {
  if (!section) return;
  const sectionName = preservedSectionName(section);
  switch (section.type) {
    case 'bullets': {
      children.push(...sectionHeading(sectionName));
      for (const item of (Array.isArray(section.content) ? section.content : [])) {
        children.push(bulletParagraph(stripEmDashes(item)));
      }
      break;
    }
    case 'text': {
      children.push(...sectionHeading(sectionName));
      children.push(new Paragraph({
        children: [new TextRun({ text: stripEmDashes(typeof section.content === 'string' ? section.content : ''), size: 20, font: 'Calibri', color: DARK_GREY })],
        spacing: { after: 200, line: 276 },
      }));
      break;
    }
    case 'verbatim': {
      children.push(...sectionHeading(sectionName));
      for (const item of (Array.isArray(section.content) ? section.content : [section.content])) {
        children.push(new Paragraph({
          children: [new TextRun({ text: item || '', italics: true, size: 20, font: 'Calibri', color: DARK_GREY })],
          spacing: { before: 80, after: 80 },
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 8 } },
        }));
      }
      break;
    }
    case 'functional_clusters': {
      children.push(...sectionHeading('Work Experience'));
      for (const cluster of (Array.isArray(section.content) ? section.content : [])) {
        // Cluster heading (skill category name)
        children.push(new Paragraph({
          children: [new TextRun({ text: cluster.heading || '', bold: true, color: NAVY, size: 22, font: 'Calibri' })],
          spacing: { before: 160, after: 40 },
        }));
        // Attribution line if present
        if (cluster.attribution) {
          children.push(new Paragraph({
            children: [new TextRun({ text: cluster.attribution, italics: true, size: 20, font: 'Calibri', color: DARK_GREY })],
            spacing: { after: 60 },
          }));
        }
        // Bullets
        for (const bullet of (cluster.bullets || [])) {
          children.push(bulletParagraph(stripEmDashes(bullet)));
        }
      }
      break;
    }
    default:
      break;
  }
}

// ─── Generate Resume .docx ───────────────────────────────────────────────────
export async function generateResumeDocx(headers, experience, addedSections = {}, preservedSections = []) {
  const children = [];

  // Normalise — AI occasionally returns {} or a string instead of []
  const ps = Array.isArray(preservedSections) ? preservedSections : [];
  const preExperience      = ps.filter(s => s.position === 'pre_experience');
  const postExperience     = ps.filter(s => s.position === 'post_experience');
  const functionalClusters = ps.find(s => s.position === 'experience' && s.type === 'functional_clusters');

  // ── Resume Header: Name → Contact line (incl. LinkedIn) → Job Title ─────────
  // Parse contact string: "Full Name | email | phone | location | linkedin"
  const contactParts  = (headers.contact || '').split('|').map(p => p.trim()).filter(Boolean);
  const candidateName = contactParts[0] || '';
  const linkedInPart  = contactParts.find(p => p.toLowerCase().includes('linkedin.com')) || '';
  const otherParts    = contactParts.filter(p => p !== candidateName && p !== linkedInPart);

  // Merge LinkedIn into the contact line: email | phone | location | linkedin
  const contactLine   = [...otherParts, ...(linkedInPart ? [linkedInPart] : [])].join(' | ');

  // 1. Candidate name — largest, Palatino Linotype
  if (candidateName) {
    children.push(
      new Paragraph({
        children: [new TextRun({
          text: candidateName,
          bold: true, color: NAVY, size: 40,
          font: 'Palatino Linotype',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
      })
    );
  }

  // 2. Single contact line — email | phone | location | LinkedIn
  if (contactLine) {
    children.push(
      new Paragraph({
        children: [new TextRun({
          text: contactLine,
          size: 18, font: 'Calibri', color: DARK_GREY,
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      })
    );
  }

  // 3. Job title — aligned to JD
  if (headers.optimisedTitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({
          text: headers.optimisedTitle,
          bold: true, color: NAVY, size: 26,
          font: 'Calibri',
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      })
    );
  }

  // ── Professional Summary — nullable for functional resumes without an opening statement
  if (headers.summary) {
    children.push(...sectionHeading('Professional Summary'));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: headers.summary,
            size: 20,
            font: 'Calibri',
            color: DARK_GREY,
          }),
        ],
        spacing: { after: 200, line: 276 },
      })
    );
  }

  // ── Pre-experience preserved sections (e.g. Accomplishments)
  for (const s of preExperience) renderPreservedSection(s, children);

  // ── Skills
  if (headers.skills?.length > 0) addListSection(children, 'Skills / Core Competencies', headers.skills);

  // ── Tools
  if (headers.tools?.length > 0) addListSection(children, 'Tools & Technologies', headers.tools);

  // ── Work Experience — functional clusters OR standard chronological jobs
  if (functionalClusters) {
    renderPreservedSection(functionalClusters, children);
  } else if (experience && experience.length > 0) {
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

  // ── Post-experience preserved sections (Leadership Principles, Recommendations, etc.)
  for (const s of postExperience) renderPreservedSection(s, children);

  // ── Additional / User-Added Sections
  // Semicolons are the AI's item separator (per prompt rules: no em-dashes, use semicolons).
  // ≤ 3 items → each on its own line; > 3 items → pipe-separated on one line.
  if (headers.additionalSections) {
    for (const [section, content] of Object.entries(headers.additionalSections)) {
      if (content && content.trim()) {
        const headingText = normaliseSectionName(section);
        const items = stripEmDashes(content).split(';').map(s => s.trim()).filter(Boolean);
        children.push(...sectionHeading(headingText));
        if (items.length <= 3) {
          for (const item of items) {
            children.push(new Paragraph({
              children: [new TextRun({ text: item, size: 20, font: 'Calibri', color: DARK_GREY })],
              spacing: { after: 80 },
            }));
          }
          // Small gap after the section
          children.push(new Paragraph({ spacing: { after: 120 } }));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: items.join(' | '), size: 20, font: 'Calibri', color: DARK_GREY })],
            spacing: { after: 200 },
          }));
        }
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width:  convertInchesToTwip(8.5),  // US Letter
              height: convertInchesToTwip(11),
            },
            margin: {
              top:    convertInchesToTwip(0.65),
              right:  convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1),
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
export async function generateAnalysisDocx(analysis, atsPreview, companyName, jobTitle, sectionsWereAdded) {
  const children = [];

  // ── Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Score & Analytics Report',
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
  const scoreColor = colorForScore(score);

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
          text: `  (${analysis.requirementsAnalysed || 0} requirements analyzed)`,
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

  // ── ATS Dashboard (from atsPreview — shown when available) ──────────────────
  if (atsPreview) {
    children.push(...sectionHeading('ATS DASHBOARD'));

    // Disclaimer
    children.push(new Paragraph({
      spacing: { before: 80, after: 160 },
      shading: { fill: 'FFF9C4', type: ShadingType.CLEAR },
      children: [new TextRun({
        text: '⚠  Simulated ATS evaluation for self-assessment only. Actual ATS systems vary by employer.',
        font: 'Calibri', size: 17, color: '7D6008', italics: true,
      })],
    }));

    // Four metric cells as a table row
    const dispBg = atsPreview.dispositionColor === 'green' ? 'DCFCE7'
                 : atsPreview.dispositionColor === 'amber' ? 'FEF9C3' : 'FEE2E2';
    const dispFg = atsPreview.dispositionColor === 'green' ? '15803D'
                 : atsPreview.dispositionColor === 'amber' ? 'A16207' : 'B91C1C';

    const metricCell = (label, value, bg = 'F9FAFB') => new TableCell({
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      children: [
        new Paragraph({ children: [new TextRun({ text: label, font: 'Calibri', size: 16, color: '9CA3AF', bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: String(value ?? '—'), font: 'Calibri', size: 28, bold: true, color: NAVY })] }),
      ],
    });

    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2340, 2340, 2340, 2340],
      rows: [new TableRow({ children: [
        metricCell('ATS SCORE', `${atsPreview.atsScore ?? '—'} / 100`),
        metricCell('KEYWORD MATCH', `${atsPreview.keywordMatch ?? '—'}%`),
        metricCell('HARD REQS MET', `${atsPreview.hardReqsMet?.met ?? '—'} / ${atsPreview.hardReqsMet?.total ?? '—'}`),
        metricCell('DISPOSITION', atsPreview.disposition ?? '—', dispBg),
      ]})],
    }));

    // Summary line
    if (atsPreview.summary) {
      children.push(new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: atsPreview.summary, font: 'Calibri', size: 19, color: DARK_GREY, italics: true })],
      }));
    }

    // Eligibility Checks table
    if (atsPreview.eligibilityChecks?.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: 'Eligibility Checks', font: 'Calibri', size: 20, bold: true, color: NAVY })] }));

      const resultColor = r => r === 'pass' ? SUCCESS : r === 'caution' ? WARNING : DANGER;
      const eligRows = atsPreview.eligibilityChecks.map((chk, i) => new TableRow({
        children: [
          new TableCell({
            shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F9FAFB', type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: chk.requirement || '', font: 'Calibri', size: 18, color: DARK_GREY })] })],
          }),
          new TableCell({
            shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F9FAFB', type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: chk.evidence || '', font: 'Calibri', size: 18, color: DARK_GREY, italics: true })] })],
          }),
          new TableCell({
            shading: { fill: i % 2 === 0 ? 'FFFFFF' : 'F9FAFB', type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: (chk.result || '').toUpperCase(), font: 'Calibri', size: 18, bold: true, color: resultColor(chk.result) })] })],
          }),
        ],
      }));
      const eligHeader = new TableRow({ tableHeader: true, children: [
        new TableCell({ shading: { fill: NAVY, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: 'Requirement', font: 'Calibri', size: 18, bold: true, color: 'FFFFFF' })] })] }),
        new TableCell({ shading: { fill: NAVY, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: 'Evidence', font: 'Calibri', size: 18, bold: true, color: 'FFFFFF' })] })] }),
        new TableCell({ shading: { fill: NAVY, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: 'Result', font: 'Calibri', size: 18, bold: true, color: 'FFFFFF' })] })] }),
      ]});
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [5200, 2960, 1200],
        rows: [eligHeader, ...eligRows],
      }));
    }

    // Scoring Breakdown
    if (atsPreview.scoringBreakdown?.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: 'Scoring Breakdown', font: 'Calibri', size: 20, bold: true, color: NAVY })] }));
      for (const dim of atsPreview.scoringBreakdown) {
        const score = dim.score ?? 0;
        const barColor = colorForScore(score);
        children.push(new Paragraph({
          spacing: { before: 60, after: 40 },
          children: [
            new TextRun({ text: `${dim.dimension || ''}  `, font: 'Calibri', size: 18, color: DARK_GREY }),
            new TextRun({ text: `${score}%`, font: 'Calibri', size: 18, bold: true, color: barColor }),
          ],
        }));
      }
    }
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
      const statusColor = req.status === 'STRONG' ? SUCCESS : req.status === 'PARTIAL' ? WARNING : DANGER; // status-based, not score-based
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
            size: {
              width:  convertInchesToTwip(8.5),  // US Letter
              height: convertInchesToTwip(11),
            },
            margin: {
              top:    convertInchesToTwip(1),
              right:  convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1),
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

  // Body — strip em-dashes then split on newlines, detect bullet formats
  const lines = stripEmDashes(coverLetterText || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // New format: "• Skill label: evidence text"  (bold before the colon)
    const dotBulletMatch = trimmed.match(/^[•·]\s+(.+)$/);
    // Legacy markdown formats kept for backward compat
    const boldBulletMatch = !dotBulletMatch && trimmed.match(/^-\s+\*\*(.+?)\*\*(.*)$/);
    const plainBulletMatch = !dotBulletMatch && !boldBulletMatch && trimmed.match(/^-\s+(.+)$/);

    if (dotBulletMatch) {
      const content  = dotBulletMatch[1];
      const colonIdx = content.indexOf(':');
      const runs = colonIdx !== -1
        ? [
            new TextRun({ text: content.slice(0, colonIdx),           bold: true, size: 22, font: 'Calibri', color: DARK_GREY }),
            new TextRun({ text: content.slice(colonIdx) /* incl. : */, size: 22, font: 'Calibri', color: DARK_GREY }),
          ]
        : [new TextRun({ text: content, size: 22, font: 'Calibri', color: DARK_GREY })];
      children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 100 }, children: runs }));
    } else if (boldBulletMatch) {
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
      const content  = plainBulletMatch[1];
      const colonIdx = content.indexOf(':');
      const runs = colonIdx !== -1
        ? [
            new TextRun({ text: content.slice(0, colonIdx),           bold: true, size: 22, font: 'Calibri', color: DARK_GREY }),
            new TextRun({ text: content.slice(colonIdx) /* incl. : */, size: 22, font: 'Calibri', color: DARK_GREY }),
          ]
        : [new TextRun({ text: content, size: 22, font: 'Calibri', color: DARK_GREY })];
      children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 100 }, children: runs }));
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
          size: {
            width:  convertInchesToTwip(8.5),  // US Letter
            height: convertInchesToTwip(11),
          },
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
