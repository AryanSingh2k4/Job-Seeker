// Modern Clean Resume Template (JobSeeker §12)
// Sans-serif font (Inter / Helvetica fallback), single-column.

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
    font: ("Inter", "Helvetica", "Arial"),
    size: 9.5pt,
  )
  #set par(justify: true, leading: 0.55em)

  #align(left)[
    #text(size: 18pt, weight: "bold", fill: rgb(30, 41, 59))[#name] \
    #v(2pt)
    #text(size: 9pt, fill: rgb(71, 85, 105))[
      #location · #email · #phone
      #if linkedin != none [ · #linkedin ]
      #if github != none [ · #github ]
    ]
  ]

  #v(8pt)
  #line(length: 100%, stroke: 1pt + rgb(226, 232, 240))

  #if summary != "" [
    #v(4pt)
    #text(weight: "bold", size: 10.5pt, fill: rgb(15, 23, 42))[Summary] \
    #v(2pt)
    #summary
    #v(6pt)
  ]

  #if skills_by_category.len() > 0 [
    #v(4pt)
    #text(weight: "bold", size: 10.5pt, fill: rgb(15, 23, 42))[Skills] \
    #v(2pt)
    #for (cat, items) in skills_by_category [
      *#cat:* #items.join(", ") \
    ]
    #v(6pt)
  ]

  #if experiences.len() > 0 [
    #v(4pt)
    #text(weight: "bold", size: 10.5pt, fill: rgb(15, 23, 42))[Experience] \
    #for exp in experiences [
      #v(4pt)
      #grid(
        columns: (1fr, auto),
        [*#exp.role_title* · #emph(exp.company_name)],
        [#text(size: 9pt, fill: rgb(100, 116, 139))[#exp.start_date – #exp.end_date]],
      )
      #if exp.at("location", default: none) != none [
        #text(size: 8.5pt, fill: rgb(100, 116, 139))[#exp.location] \
      ]
      #for b in exp.bullets [
        - #b
      ]
    ]
    #v(6pt)
  ]

  #if projects.len() > 0 [
    #v(4pt)
    #text(weight: "bold", size: 10.5pt, fill: rgb(15, 23, 42))[Projects] \
    #for proj in projects [
      #v(3pt)
      *#proj.name* #if proj.technologies.len() > 0 [ (#proj.technologies.join(", ")) ] \
      #if proj.description != "" [ #proj.description \ ]
      #for b in proj.bullets [
        - #b
      ]
    ]
    #v(6pt)
  ]

  #if education.len() > 0 [
    #v(4pt)
    #text(weight: "bold", size: 10.5pt, fill: rgb(15, 23, 42))[Education] \
    #for edu in education [
      #v(3pt)
      #grid(
        columns: (1fr, auto),
        [*#edu.institution* · #emph(edu.degree) in #edu.field_of_study],
        [#text(size: 9pt, fill: rgb(100, 116, 139))[#edu.start_year – #edu.end_year]],
      )
    ]
  ]
]
