import React, { useState, useEffect } from 'react';
import './CVPreview.css';

const API_URL = 'http://localhost:8000';

function CVPreview({ profile, onSectionClick, hiddenItems = {} }) {
  const [userName, setUserName] = useState('');
  const contactInfo = profile?.contact_info || {};
  const sections = profile?.sections || {};

  // Fetch user's full name
  useEffect(() => {
    const fetchUserName = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const user = await response.json();
          setUserName(user.full_name || 'Your Name');
        }
      } catch (err) {
        console.error('Error fetching user:', err);
      }
    };
    fetchUserName();
  }, []);

  // Extract username from LinkedIn/GitHub URLs
  const getLinkedInUsername = (url) => {
    if (!url) return '';
    const match = url.match(/linkedin\.com\/in\/([^\/]+)/);
    return match ? match[1] : url;
  };

  const getGitHubUsername = (url) => {
    if (!url) return '';
    const match = url.match(/github\.com\/([^\/]+)/);
    return match ? match[1] : url;
  };

  // Sort sections by order field
  const sortedSections = Array.isArray(sections)
    ? [...sections].sort((a, b) => (a.order || 0) - (b.order || 0))
    : [];

  // Render section content based on type
  const renderSectionContent = (section) => {
    switch (section.section_type) {
      case 'summary':
        return renderSummarySection(section);
      case 'work_experience':
        return renderWorkExperienceSection(section);
      case 'education':
        return renderEducationSection(section);
      case 'skills':
        return renderSkillsSection(section);
      case 'projects':
        return renderProjectsSection(section);
      case 'certifications':
        return renderCertificationsSection(section);
      case 'awards':
        return renderAwardsSection(section);
      case 'publications':
        return renderPublicationsSection(section);
      case 'languages':
        return renderLanguagesSection(section);
      default:
        return renderCustomSection(section);
    }
  };

  // Summary Section Renderer
  const renderSummarySection = (summarySection) => (
    <section className="cv-section" key={summarySection.id}>
      <h3
        className="cv-section-title"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onSectionClick && onSectionClick({ section: summarySection, target: 'title' });
        }}
      >
        Summary of Qualifications
      </h3>
      <div className="cv-section-content">
        {summarySection.content ? (
          <div
            className="cv-summary-text"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSectionClick && onSectionClick({ section: summarySection, target: 'content', type: 'text' });
            }}
          >
            {summarySection.content}
          </div>
        ) : summarySection.entries && summarySection.entries.length > 0 ? (
          <div className="cv-summary-bullets">
            {summarySection.entries.flatMap(entry =>
              entry.items || []
            ).filter(item => !hiddenItems[item.id]).map((item, idx) => (
              <div
                key={item.id || idx}
                className="cv-bullet"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSectionClick && onSectionClick({ section: summarySection, target: 'item', itemId: item.id, type: 'bullet' });
                }}
              >
                • {item.content}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="cv-placeholder"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onSectionClick && onSectionClick({ section: summarySection, target: 'empty' });
            }}
          >
            Add your summary here...
          </div>
        )}
      </div>
    </section>
  );

  // Work Experience Section Renderer
  const renderWorkExperienceSection = (workSection) => (
    <section
      className="cv-section"
      key={workSection.id}
      onDoubleClick={() => onSectionClick && onSectionClick(workSection)}
    >
      <h3 className="cv-section-title">Professional Experience</h3>
      <div className="cv-section-content">
        {workSection.entries && workSection.entries.filter(e => !e.parent_entry_id).length > 0 ? (
          workSection.entries.filter(e => !e.parent_entry_id).map(job => (
            <div key={job.id} className="cv-job">
              <div
                className="cv-job-header"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSectionClick && onSectionClick({ section: workSection, target: 'entry', entryId: job.id });
                }}
              >
                <div className="cv-job-title-line">
                  <strong className="cv-job-title">{job.title}</strong>
                  <span className="cv-job-location">{job.location}</span>
                </div>
                <div className="cv-job-company-line">
                  <span className="cv-job-company">{job.subtitle}</span>
                  <span className="cv-job-dates">
                    {job.start_date && job.end_date ? `${job.start_date} - ${job.end_date}` : ''}
                  </span>
                </div>
              </div>

              {/* Job description */}
              {job.description && (
                <div className="cv-job-description">• {job.description}</div>
              )}

              {/* Direct bullets (not in groups) */}
              {job.items && job.items.length > 0 && (
                <div className="cv-job-bullets">
                  {job.items.filter(item => !hiddenItems[item.id]).map(item => (
                    <div key={item.id} className="cv-bullet">• {item.content}</div>
                  ))}
                </div>
              )}

              {/* Bullet Groups */}
              {job.sub_entries && job.sub_entries.length > 0 && (
                <div className="cv-bullet-groups">
                  {job.sub_entries.map(group => (
                    <div key={group.id} className="cv-bullet-group">
                      <div
                        className="cv-bullet-group-title"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onSectionClick && onSectionClick({ section: workSection, target: 'subentry', entryId: job.id, subEntryId: group.id });
                        }}
                      >
                        • {group.title}
                      </div>
                      {group.items && group.items.length > 0 && (
                        <div className="cv-bullet-group-items">
                          {group.items.filter(item => !hiddenItems[item.id]).map(item => (
                            <div key={item.id} className="cv-bullet-sub">– {item.content}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="cv-placeholder">Add your work experience here...</div>
        )}
      </div>
    </section>
  );

  // Education Section Renderer
  const renderEducationSection = (educationSection) => (
    <section
      className="cv-section"
      key={educationSection.id}
      onDoubleClick={() => onSectionClick && onSectionClick(educationSection)}
    >
      <h3 className="cv-section-title">Education</h3>
      <div className="cv-section-content">
        {educationSection.entries && educationSection.entries.filter(e => !e.parent_entry_id).length > 0 ? (
          educationSection.entries.filter(e => !e.parent_entry_id).map(edu => (
            <div key={edu.id} className="cv-education">
              <div
                className="cv-edu-header"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSectionClick && onSectionClick({ section: educationSection, target: 'entry', entryId: edu.id });
                }}
              >
                <div className="cv-edu-title-line">
                  <strong className="cv-edu-degree">{edu.title}</strong>
                  <span className="cv-edu-location">{edu.location}</span>
                </div>
                <div className="cv-edu-school-line">
                  <span className="cv-edu-school">{edu.subtitle}</span>
                  <span className="cv-edu-dates">
                    {edu.start_date && edu.end_date ? `${edu.start_date} - ${edu.end_date}` : ''}
                  </span>
                </div>
              </div>

              {/* Description */}
              {edu.description && (
                <div className="cv-job-description">• {edu.description}</div>
              )}

              {/* Direct bullets (not in groups) */}
              {edu.items && edu.items.length > 0 && (
                <div className="cv-edu-bullets">
                  {edu.items.filter(item => !hiddenItems[item.id]).map(item => (
                    <div key={item.id} className="cv-bullet">• {item.content}</div>
                  ))}
                </div>
              )}

              {/* Bullet Groups */}
              {edu.sub_entries && edu.sub_entries.length > 0 && (
                <div className="cv-bullet-groups">
                  {edu.sub_entries.map(group => (
                    <div key={group.id} className="cv-bullet-group">
                      <div
                        className="cv-bullet-group-title"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onSectionClick && onSectionClick({ section: educationSection, target: 'subentry', entryId: edu.id, subEntryId: group.id });
                        }}
                      >
                        • {group.title}
                      </div>
                      {group.items && group.items.length > 0 && (
                        <div className="cv-bullet-group-items">
                          {group.items.filter(item => !hiddenItems[item.id]).map(item => (
                            <div key={item.id} className="cv-bullet-sub">– {item.content}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="cv-placeholder">Add your education here...</div>
        )}
      </div>
    </section>
  );

  // Skills Section Renderer
  const renderSkillsSection = (skillsSection) => {
    // Get layout preference from meta_info (default to 'double')
    const layout = skillsSection.meta_info?.layout || 'double';
    const gridClass = layout === 'single' ? 'cv-skills-single' : 'cv-skills-grid';

    return (
      <section
        className="cv-section"
        key={skillsSection.id}
        onDoubleClick={() => onSectionClick && onSectionClick(skillsSection)}
      >
        <h3 className="cv-section-title">Core Skills</h3>
        <div className="cv-section-content">
          {skillsSection.entries && skillsSection.entries.length > 0 ? (
            <div className={gridClass}>
              {skillsSection.entries.map(category => (
                <div key={category.id} className="cv-skill-category">
                  <h4
                    className="cv-skill-category-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSectionClick && onSectionClick({ section: skillsSection, target: 'entry', entryId: category.id });
                    }}
                  >
                    {category.title}:
                  </h4>
                  {category.items && category.items.length > 0 && (
                    <ul className="cv-skill-list">
                      {category.items.filter(item => !hiddenItems[item.id]).map(item => (
                        <li
                          key={item.id}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSectionClick && onSectionClick({ section: skillsSection, target: 'item', entryId: category.id, itemId: item.id });
                          }}
                        >
                          {item.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="cv-placeholder">Add your skills here...</div>
          )}
        </div>
      </section>
    );
  };

  // Projects Section Renderer
  const renderProjectsSection = (projectsSection) => {
    return (
      <section
        className="cv-section"
        key={projectsSection.id}
        onDoubleClick={() => onSectionClick && onSectionClick(projectsSection)}
      >
        <h3 className="cv-section-title">Projects</h3>
        <div className="cv-section-content">
          {projectsSection.entries && projectsSection.entries.length > 0 ? (
            <div className="cv-projects-list">
              {projectsSection.entries.map(project => (
                <div key={project.id} className="cv-project">
                  <h4
                    className="cv-project-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSectionClick && onSectionClick({ section: projectsSection, target: 'entry', entryId: project.id });
                    }}
                  >
                    {project.title}
                  </h4>
                  {project.items && project.items.length > 0 && (
                    <ul className="cv-project-details">
                      {project.items.filter(item => !hiddenItems[item.id]).map(item => (
                        <li
                          key={item.id}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSectionClick && onSectionClick({ section: projectsSection, target: 'item', entryId: project.id, itemId: item.id });
                          }}
                        >
                          {item.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="cv-placeholder">Add your projects here...</div>
          )}
        </div>
      </section>
    );
  };

  // Certifications Section Renderer
  const renderCertificationsSection = (certificationsSection) => {
    return (
      <section
        className="cv-section"
        key={certificationsSection.id}
        onDoubleClick={() => onSectionClick && onSectionClick(certificationsSection)}
      >
        <h3 className="cv-section-title">Certifications</h3>
        <div className="cv-section-content">
          {certificationsSection.entries && certificationsSection.entries.length > 0 ? (
            <div className="cv-certifications-list">
              {certificationsSection.entries.map(cert => (
                <div key={cert.id} className="cv-certification">
                  <h4
                    className="cv-certification-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSectionClick && onSectionClick({ section: certificationsSection, target: 'entry', entryId: cert.id });
                    }}
                  >
                    {cert.title}
                  </h4>
                  {cert.items && cert.items.length > 0 && (
                    <ul className="cv-certification-details">
                      {cert.items.filter(item => !hiddenItems[item.id]).map(item => (
                        <li
                          key={item.id}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSectionClick && onSectionClick({ section: certificationsSection, target: 'item', entryId: cert.id, itemId: item.id });
                          }}
                        >
                          {item.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="cv-placeholder">Add your certifications here...</div>
          )}
        </div>
      </section>
    );
  };

  // Awards Section Renderer
  const renderAwardsSection = (awardsSection) => {
    return (
      <section
        className="cv-section"
        key={awardsSection.id}
        onDoubleClick={() => onSectionClick && onSectionClick(awardsSection)}
      >
        <h3 className="cv-section-title">Awards & Honors</h3>
        <div className="cv-section-content">
          {awardsSection.entries && awardsSection.entries.length > 0 ? (
            <div className="cv-awards-list">
              {awardsSection.entries.map(award => (
                <div key={award.id} className="cv-award">
                  <h4
                    className="cv-award-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSectionClick && onSectionClick({ section: awardsSection, target: 'entry', entryId: award.id });
                    }}
                  >
                    {award.title}
                  </h4>
                  {award.items && award.items.length > 0 && (
                    <ul className="cv-award-details">
                      {award.items.filter(item => !hiddenItems[item.id]).map(item => (
                        <li
                          key={item.id}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSectionClick && onSectionClick({ section: awardsSection, target: 'item', entryId: award.id, itemId: item.id });
                          }}
                        >
                          {item.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="cv-placeholder">Add your awards here...</div>
          )}
        </div>
      </section>
    );
  };

  // Publications Section Renderer
  const renderPublicationsSection = (publicationsSection) => {
    return (
      <section
        className="cv-section"
        key={publicationsSection.id}
        onDoubleClick={() => onSectionClick && onSectionClick(publicationsSection)}
      >
        <h3 className="cv-section-title">Publications</h3>
        <div className="cv-section-content">
          {publicationsSection.entries && publicationsSection.entries.length > 0 ? (
            <div className="cv-publications-list">
              {publicationsSection.entries.map(pub => (
                <div key={pub.id} className="cv-publication">
                  <div
                    className="cv-publication-title"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSectionClick && onSectionClick({ section: publicationsSection, target: 'entry', entryId: pub.id });
                    }}
                  >
                    {pub.title}
                  </div>
                  {pub.items && pub.items.length > 0 && (
                    <ul className="cv-publication-details">
                      {pub.items.filter(item => !hiddenItems[item.id]).map(item => (
                        <li
                          key={item.id}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSectionClick && onSectionClick({ section: publicationsSection, target: 'item', entryId: pub.id, itemId: item.id });
                          }}
                        >
                          {item.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="cv-placeholder">Add your publications here...</div>
          )}
        </div>
      </section>
    );
  };

  // Languages Section Renderer
  const renderLanguagesSection = (languagesSection) => {
    return (
      <section
        className="cv-section"
        key={languagesSection.id}
        onDoubleClick={() => onSectionClick && onSectionClick(languagesSection)}
      >
        <h3 className="cv-section-title">Languages</h3>
        <div className="cv-section-content">
          {languagesSection.entries && languagesSection.entries.length > 0 ? (
            <div className="cv-languages-list">
              {languagesSection.entries.map(lang => (
                <div key={lang.id} className="cv-language">
                  <h4
                    className="cv-language-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSectionClick && onSectionClick({ section: languagesSection, target: 'entry', entryId: lang.id });
                    }}
                  >
                    {lang.title}
                  </h4>
                  {lang.items && lang.items.length > 0 && (
                    <ul className="cv-language-proficiency">
                      {lang.items.filter(item => !hiddenItems[item.id]).map(item => (
                        <li
                          key={item.id}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSectionClick && onSectionClick({ section: languagesSection, target: 'item', entryId: lang.id, itemId: item.id });
                          }}
                        >
                          {item.content}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="cv-placeholder">Add your languages here...</div>
          )}
        </div>
      </section>
    );
  };

  // Custom Section Renderer
  const renderCustomSection = (section) => (
    <section
      key={section.id}
      className="cv-section"
      onDoubleClick={() => onSectionClick && onSectionClick(section)}
    >
      <h3 className="cv-section-title">{section.title}</h3>
      <div className="cv-section-content">
        {section.content && (
          <div className="cv-text-content">{section.content}</div>
        )}
        {section.entries && section.entries.length > 0 ? (
          section.entries.map(entry => (
            <div key={entry.id} className="cv-entry">
              <strong>{entry.title}</strong>
              {entry.subtitle && <span> - {entry.subtitle}</span>}
              {entry.items && entry.items.length > 0 && (
                <div className="cv-entry-bullets">
                  {entry.items.filter(item => !hiddenItems[item.id]).map(item => (
                    <div key={item.id} className="cv-bullet">• {item.content}</div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          !section.content && <div className="cv-placeholder">Add content here...</div>
        )}
      </div>
    </section>
  );

  return (
    <div className="cv-preview">
      <div className="cv-page">
        {/* Header */}
        <header className="cv-header">
          <h1 className="cv-name">
            {userName || 'Your Name'}
          </h1>
          <h2 className="cv-job-title">
            {contactInfo.job_title || 'Job Title'}
          </h2>
          <div className="cv-location">
            {contactInfo.location || 'Location'}
          </div>
          <div className="cv-contact">
            {contactInfo.phone && (
              <span className="cv-contact-item">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                  <path d="M3.654 1.328a.678.678 0 0 0-1.015-.063L1.605 2.3c-.483.484-.661 1.169-.45 1.77a17.568 17.568 0 0 0 4.168 6.608 17.569 17.569 0 0 0 6.608 4.168c.601.211 1.286.033 1.77-.45l1.034-1.034a.678.678 0 0 0-.063-1.015l-2.307-1.794a.678.678 0 0 0-.58-.122l-2.19.547a1.745 1.745 0 0 1-1.657-.459L5.482 8.062a1.745 1.745 0 0 1-.46-1.657l.548-2.19a.678.678 0 0 0-.122-.58L3.654 1.328z"/>
                </svg>
                {contactInfo.phone}
              </span>
            )}
            {contactInfo.email && (
              <span className="cv-contact-item">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                  <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414.05 3.555ZM0 4.697v7.104l5.803-3.558L0 4.697ZM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586l-1.239-.757Zm3.436-.586L16 11.801V4.697l-5.803 3.546Z"/>
                </svg>
                {contactInfo.email}
              </span>
            )}
            {contactInfo.linkedin && (
              <span className="cv-contact-item">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                  <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
                </svg>
                {getLinkedInUsername(contactInfo.linkedin)}
              </span>
            )}
            {contactInfo.github && (
              <span className="cv-contact-item">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                {getGitHubUsername(contactInfo.github)}
              </span>
            )}
          </div>
        </header>

        {/* Render sections dynamically based on order */}
        {sortedSections.map(section => renderSectionContent(section))}

        {/* Footer */}
        <footer className="cv-footer">
          <div className="cv-footer-date">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default CVPreview;
