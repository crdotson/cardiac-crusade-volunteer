import { useState, useRef, useEffect, type FC, type ChangeEvent } from 'react';
import axios from 'axios';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Unlink,
  Image as ImageIcon,
  Upload,
  Undo,
  Redo,
  Eye,
  Edit3,
  Trash2
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Add rich text, links, instructions, and pictures here...'
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [selectedImgElement, setSelectedImgElement] = useState<HTMLImageElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize external value into editor without resetting active cursor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      // Only update if not actively focused, or if empty
      if (document.activeElement !== editorRef.current || !editorRef.current.innerHTML) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value, activeTab]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleHeading = (tag: 'h1' | 'h2' | 'h3' | 'p') => {
    executeCommand('formatBlock', tag);
  };

  const handleAddLink = () => {
    const url = window.prompt('Enter link URL (e.g. https://example.com):');
    if (url) {
      const validUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      executeCommand('createLink', validUrl);
    }
  };

  const handleRemoveLink = () => {
    executeCommand('unlink');
  };

  const handleTriggerUpload = () => {
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Selected file must be an image (PNG, JPG, WebP, GIF, or SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size cannot exceed 5MB.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await axios.post('api/settings/images', {
            filename: file.name,
            mime_type: file.type,
            data: base64Data
          });

          const imageUrl = res.data.url;
          const imgHtml = `<p style="text-align: center;"><img src="${imageUrl}" alt="${file.name}" style="max-width: 100%; height: auto; border-radius: 6px; display: inline-block; margin: 0.5rem auto;" /></p><p></p>`;

          if (editorRef.current) {
            editorRef.current.focus();
            const inserted = document.execCommand('insertHTML', false, imgHtml);
            if (!inserted) {
              editorRef.current.innerHTML += imgHtml;
            }
            handleInput();
          }
        } catch (err: any) {
          console.error('Image upload error:', err);
          setUploadError(err.response?.data?.error || 'Failed to upload image. Please try again.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsUploading(false);
      setUploadError('Failed to read image file.');
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      setSelectedImgElement(target as HTMLImageElement);
    } else {
      setSelectedImgElement(null);
    }
  };

  const updateSelectedImage = (styles: Partial<CSSStyleDeclaration>) => {
    if (!selectedImgElement) return;
    Object.assign(selectedImgElement.style, styles);
    handleInput();
  };

  const deleteSelectedImage = () => {
    if (!selectedImgElement) return;
    selectedImgElement.remove();
    setSelectedImgElement(null);
    handleInput();
  };

  return (
    <div className="rich-editor-container">
      {/* Tab Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className={activeTab === 'edit' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('edit')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Edit3 size={14} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className={activeTab === 'preview' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('preview')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Eye size={14} />
            <span>Live Login Preview</span>
          </button>
        </div>

        {isUploading && (
          <span style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}>
            Uploading picture...
          </span>
        )}
      </div>

      {uploadError && (
        <div className="error-message" style={{ marginBottom: '0.5rem', padding: '0.5rem' }}>
          {uploadError}
        </div>
      )}

      {activeTab === 'edit' ? (
        <div className="rich-editor-card" style={{ border: '1px solid var(--light-gray)', borderRadius: '6px', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div className="rich-editor-toolbar" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            padding: '6px 8px',
            background: '#f8f9fa',
            borderBottom: '1px solid var(--light-gray)',
            alignItems: 'center'
          }}>
            {/* Formatting */}
            <button
              type="button"
              className="toolbar-btn"
              title="Bold"
              onClick={() => executeCommand('bold')}
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Italic"
              onClick={() => executeCommand('italic')}
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Underline"
              onClick={() => executeCommand('underline')}
            >
              <Underline size={15} />
            </button>

            <span className="toolbar-separator" />

            {/* Headings */}
            <button
              type="button"
              className="toolbar-btn"
              title="Heading 1"
              onClick={() => handleHeading('h1')}
            >
              <Heading1 size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Heading 2"
              onClick={() => handleHeading('h2')}
            >
              <Heading2 size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Heading 3"
              onClick={() => handleHeading('h3')}
            >
              <Heading3 size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Normal Paragraph"
              onClick={() => handleHeading('p')}
              style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 6px' }}
            >
              P
            </button>

            <span className="toolbar-separator" />

            {/* Lists */}
            <button
              type="button"
              className="toolbar-btn"
              title="Bullet List"
              onClick={() => executeCommand('insertUnorderedList')}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Numbered List"
              onClick={() => executeCommand('insertOrderedList')}
            >
              <ListOrdered size={15} />
            </button>

            <span className="toolbar-separator" />

            {/* Alignments */}
            <button
              type="button"
              className="toolbar-btn"
              title="Align Left"
              onClick={() => executeCommand('justifyLeft')}
            >
              <AlignLeft size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Align Center"
              onClick={() => executeCommand('justifyCenter')}
            >
              <AlignCenter size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Align Right"
              onClick={() => executeCommand('justifyRight')}
            >
              <AlignRight size={15} />
            </button>

            <span className="toolbar-separator" />

            {/* Links */}
            <button
              type="button"
              className="toolbar-btn"
              title="Insert Link"
              onClick={handleAddLink}
            >
              <Link2 size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Remove Link"
              onClick={handleRemoveLink}
            >
              <Unlink size={15} />
            </button>

            <span className="toolbar-separator" />

            {/* Picture Upload */}
            <button
              type="button"
              className="toolbar-btn primary-tint"
              title="Upload and insert picture"
              onClick={handleTriggerUpload}
              disabled={isUploading}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
            >
              <Upload size={14} />
              <span style={{ fontSize: '0.8rem' }}>Upload Picture</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              style={{ display: 'none' }}
            />

            <span className="toolbar-separator" />

            {/* History */}
            <button
              type="button"
              className="toolbar-btn"
              title="Undo"
              onClick={() => executeCommand('undo')}
            >
              <Undo size={15} />
            </button>
            <button
              type="button"
              className="toolbar-btn"
              title="Redo"
              onClick={() => executeCommand('redo')}
            >
              <Redo size={15} />
            </button>
          </div>

          {/* Picture Toolbar (appears when an image is selected) */}
          {selectedImgElement && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              background: '#e9ecef',
              borderBottom: '1px solid var(--light-gray)',
              fontSize: '0.8rem'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ImageIcon size={14} /> Image Selected:
              </span>
              <span>Size:</span>
              <button
                type="button"
                className="secondary"
                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                onClick={() => updateSelectedImage({ width: '100%', maxWidth: '100%' })}
              >
                100%
              </button>
              <button
                type="button"
                className="secondary"
                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                onClick={() => updateSelectedImage({ width: '260px', maxWidth: '100%' })}
              >
                Medium (260px)
              </button>
              <button
                type="button"
                className="secondary"
                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                onClick={() => updateSelectedImage({ width: '140px', maxWidth: '100%' })}
              >
                Small (140px)
              </button>
              <span style={{ marginLeft: '4px' }}>Align:</span>
              <button
                type="button"
                className="secondary"
                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                onClick={() => updateSelectedImage({ display: 'block', margin: '0.5rem auto' })}
              >
                Center
              </button>
              <button
                type="button"
                className="secondary"
                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                onClick={() => updateSelectedImage({ display: 'block', margin: '0.5rem auto 0.5rem 0' })}
              >
                Left
              </button>
              <button
                type="button"
                className="danger"
                style={{ padding: '2px 6px', fontSize: '0.75rem', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={deleteSelectedImage}
              >
                <Trash2 size={12} /> Delete Picture
              </button>
            </div>
          )}

          {/* Editable Content Area */}
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            onClick={handleEditorClick}
            className="rich-editor-content"
            data-placeholder={placeholder}
            style={{
              minHeight: '220px',
              maxHeight: '450px',
              overflowY: 'auto',
              padding: '1rem',
              outline: 'none',
              background: '#ffffff',
              fontSize: '0.95rem',
              lineHeight: 1.5
            }}
          />
        </div>
      ) : (
        /* Live Preview simulating login screen */
        <div style={{
          padding: '1.5rem',
          background: '#f8f9fa',
          border: '1px dashed var(--light-gray)',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--gray)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Simulated Login Card Appearance
          </div>
          <div className="card" style={{ width: '100%', maxWidth: '400px', background: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            {value ? (
              <div
                className="login-rich-content-display"
                dangerouslySetInnerHTML={{ __html: value }}
              />
            ) : (
              <div style={{ fontStyle: 'italic', color: 'var(--gray)', textAlign: 'center', padding: '1rem 0' }}>
                No content configured. The area below the login box will remain empty.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
