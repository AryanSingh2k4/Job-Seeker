// ATS Classic Resume Template (JobSeeker §12)
// Single-column, deterministic, parseable by all major ATS parsers.

#let resume(
  name: "Candidate Name",
  phone: "+1 555-0100",
  email: "candidate@example.com",
  location: "New York, NY",
  linkedin: none,
  github: none,
  summary: "",
  skills_by_category: (:),
  experiences: (),
  education: (),
  projects: (),
) = [
  #set document(title: name + " - Resume", author: name)
  #set page(
    paper: "us-letter",
    margin: (x: 1.5cm, y: 1.5cm),
  )
  #set text(
    font: ("New Computer Modern", "Liberation Serif", "Times New Roman"),
    size: 10pt,
  )
  #set par(justify: true, leading: 0.55em)

  // Header Block
  #align(center)[
    #text(size: 16pt, weight: "bold")[#name] \
    #v(2pt)
    #text(size: 9pt)[
      #location | #email | #phone
      #if linkedin != none [ | #linkedin ]
      #if github != none [ | #github ]
    ]
  ]

  #v(8pt)
  #line(length: 100%, stroke: 0.5pt + luma(80))

  // Summary
  #if summary != "" [
    #v(4pt)
    #text(weight: "bold")[PROFESSIONAL SUMMARY] \
    #v(2pt)
    #summary
    #v(6pt)
    #line(length: 100%, stroke: 0.5pt + luma(180))
  ]

  // Skills
  #if skills_by_category.len() > 0 [
    #v(4pt)
    #text(weight: "bold")[TECHNICAL SKILLS] \
    #v(2pt)
    #for (cat, items) in skills_by_category [
      *#cat:* #items.join(", ") \
    ]
    #v(6pt)
    #line(length: 100%, stroke: 0.5pt + luma(180))
  ]

  // Experience
  #if experiences.len() > 0 [
    #v(4pt)
    #text(weight: "bold")[PROFESSIONAL EXPERIENCE] \
    #for exp in experiences [
      #v(4pt)
      #grid(
        columns: (1fr, auto),
        [*#exp.role_title* -- #emph(exp.company_name)],
        [#text(size: 9pt)[#exp.start_date -- #exp.end_date]],
      )
      #if exp.at("location", default: none) != none [
        #text(size: 8.5pt, fill: luma(80))[#exp.location] \
      ]
      #for b in exp.bullets [
        - #b
      ]
    ]
    #v(6pt)
    #line(length: 100%, stroke: 0.5pt + luma(180))
  ]

  // Projects
  #if projects.len() > 0 [
    #v(4pt)
    #text(weight: "bold")[PROJECTS] \
    #for proj in projects [
      #v(3pt)
      *#proj.name* #if proj.technologies.len() > 0 [ (#proj.technologies.join(", ")) ] \
      #if proj.description != "" [ #proj.description \ ]
      #for b in proj.bullets [
        - #b
      ]
    ]
    #v(6pt)
    #line(length: 100%, stroke: 0.5pt + luma(180))
  ]

  // Education
  #if education.len() > 0 [
    #v(4pt)
    #text(weight: "bold")[EDUCATION] \
    #for edu in education [
      #v(3pt)
      #grid(
        columns: (1fr, auto),
        [*#edu.institution* -- #emph(edu.degree) in #edu.field_of_study],
        [#text(size: 9pt)[#edu.start_year -- #edu.end_year]],
      )
    ]
  ]
]
