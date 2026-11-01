-- Pandoc filter for the handbook build.
-- After the build shifts headings down one level: parts are H1, chapters H2, sections H3
-- and the six template headings H4. Template headings get the id <section-id>--<slug> so
-- other chapters (and the troubleshooting index) can link to them, and are not numbered.
local section_id = nil

function Header(h)
  if h.level == 3 then
    section_id = h.identifier
  elseif h.level == 4 and section_id and section_id ~= '' then
    local slug = pandoc.utils.stringify(h.content):lower():gsub('[^%w]+', '-'):gsub('^-+', ''):gsub('-+$', '')
    h.identifier = section_id .. '--' .. slug
    h.classes:insert('unnumbered')
    return h
  end
end
