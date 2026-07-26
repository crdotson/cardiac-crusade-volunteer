import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Papa from 'papaparse';

interface CreateImportActionsProps {
  onUpdate: () => void;
}

const statuses = ['Unvisited', 'Left Literature', 'Engaged/No Answer', 'Interested', 'Already Has AED', 'Refused/Not Interested'];

const formatCategoryName = (name: string) => {
  if (!name) return 'N/A';
  return name.replace(/_/g, ' ')
             .split(' ')
             .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
             .join(' ');
};

const CreateImportActions: React.FC<CreateImportActionsProps> = ({ onUpdate }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<string[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  // Modals state
  const [showImport, setShowImport] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showManualAdd, setShowManualAdd] = useState(false);

  // Category Import state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [importCity, setImportCity] = useState('Lexington, KY');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isImporting, setIsImporting] = useState(false);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvImportResults, setCsvImportResults] = useState<any>(null);

  // Manual Add state
  const [manualData, setManualData] = useState<any>({
    name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: '', notes: '', lat: 38.0406, lng: -84.5037
  });
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catsRes, volsRes, settsRes] = await Promise.all([
          axios.get('api/categories').catch(() => ({ data: [] })),
          axios.get('api/users/volunteers').catch(() => ({ data: [] })),
          axios.get('api/settings').catch(() => ({ data: null }))
        ]);
        if (catsRes.data && catsRes.data.length > 0) {
          setCategories(catsRes.data);
          setSelectedCategory(catsRes.data[0]);
        }
        if (volsRes.data) setVolunteers(volsRes.data);
        if (settsRes.data) {
          setSettings(settsRes.data);
          if (settsRes.data.default_origin_city) {
            setImportCity(settsRes.data.default_origin_city);
          }
        }
      } catch (err) {
        console.error('Error fetching data for CreateImportActions', err);
      }
    };
    fetchData();
  }, []);

  // Stable Google script loader for autocomplete
  useEffect(() => {
    if ((window as any).google?.maps) {
      setIsGoogleLoaded(true);
    } else if (settings?.google_api_key) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${settings.google_api_key}&v=beta&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => {
        setIsGoogleLoaded(true);
      };
      script.onerror = () => console.error('Google Maps Script Load Error');
      document.head.appendChild(script);
    }
  }, [settings]);

  // Autocomplete initialization for manual add
  useEffect(() => {
    if (showManualAdd && isGoogleLoaded) {
      const timer = setTimeout(async () => {
        try {
          const g = (window as any).google;
          if (!g?.maps) return;

          const { PlaceAutocompleteElement } = await g.maps.importLibrary("places");
          const container = document.getElementById('list-autocomplete-container');
          if (!container) return;

          container.innerHTML = '';
          const autocomplete = new PlaceAutocompleteElement();
          autocomplete.style.width = '100%';

          if (settings?.default_origin_city) {
            const { Geocoder } = await g.maps.importLibrary("geocoding");
            const geocoder = new Geocoder();
            geocoder.geocode({ address: settings.default_origin_city }, (results: any, status: any) => {
              if (status === 'OK' && results?.[0]?.geometry?.viewport) {
                autocomplete.locationBias = results[0].geometry.viewport;
              }
            });
          }

          const handlePlaceSelect = async (e: any) => {
            const rawPlace = e.place || autocomplete.place || (e.placePrediction && typeof e.placePrediction.toPlace === 'function' ? e.placePrediction.toPlace() : null);
            if (rawPlace) {
              if (typeof rawPlace.fetchFields === 'function') {
                try {
                  await rawPlace.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
                } catch (err) {
                  console.error('Error fetching place fields:', err);
                }
              }
              const place = rawPlace;
              setManualData((prev: any) => {
                let newLat = prev.lat;
                let newLng = prev.lng;
                if (place.location) {
                  newLat = typeof place.location.lat === 'function' ? place.location.lat() : (place.location.lat !== undefined ? place.location.lat : (place.location.latitude !== undefined ? place.location.latitude : prev.lat));
                  newLng = typeof place.location.lng === 'function' ? place.location.lng() : (place.location.lng !== undefined ? place.location.lng : (place.location.longitude !== undefined ? place.location.longitude : prev.lng));
                } else if (place.geometry?.location) {
                  newLat = typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : (place.geometry.location.lat !== undefined ? place.geometry.location.lat : prev.lat);
                  newLng = typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : (place.geometry.location.lng !== undefined ? place.geometry.location.lng : prev.lng);
                }
                return {
                  ...prev,
                  address: place.formattedAddress || place.displayName || prev.address || '',
                  lat: newLat,
                  lng: newLng
                };
              });
            }
          };

          autocomplete.addEventListener('gm-placechange', handlePlaceSelect);
          autocomplete.addEventListener('gmp-placeselect', handlePlaceSelect);
          autocomplete.addEventListener('gmp-select', handlePlaceSelect);

          container.appendChild(autocomplete);

          autocomplete.addEventListener('input', (e: any) => {
            const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
            const val = path[0]?.value || e.target?.value || autocomplete.inputValue || autocomplete.value || '';
            setManualData((prev: any) => ({ ...prev, address: val }));
          });

          const shadowInput = autocomplete.shadowRoot?.querySelector('input') || autocomplete.querySelector('input');
          if (shadowInput) {
            shadowInput.setAttribute('data-1p-ignore', 'true');
            shadowInput.placeholder = "Type address or search...";
          }
        } catch (err) {
          console.error('Autocomplete Error:', err);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showManualAdd, isGoogleLoaded, settings]);

  if (!['Application Administrator', 'City Coordinator'].includes(user?.role || '')) {
    return null;
  }

  const handleSearch = async () => {
    setIsImporting(true);
    setCandidates([]);
    setSelectedCandidates(new Set());
    try {
      const res = await axios.post('api/locations/search', {
        category: selectedCategory,
        city: importCity
      });
      setCandidates(res.data);
      setSelectedCandidates(new Set(res.data.map((_: any, i: number) => i)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Search failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = async () => {
    const locationsToImport = candidates.filter((_, i) => selectedCandidates.has(i));
    if (locationsToImport.length === 0) {
      alert('Please select at least one location.');
      return;
    }
    setIsImporting(true);
    try {
      await axios.post('api/locations/confirm-import', {
        locations: locationsToImport
      });
      setShowImport(false);
      setCandidates([]);
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const toggleCandidate = (index: number) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(index)) newSelected.delete(index);
    else newSelected.add(index);
    setSelectedCandidates(newSelected);
  };

  const deselectAll = () => {
    setSelectedCandidates(new Set());
  };

  const filteredCandidates = candidates
    .map((c, originalIndex) => ({ ...c, originalIndex }))
    .filter(c => {
      const matchesText = (c.name || '').toLowerCase().includes(filterText.toLowerCase()) || 
                          (c.address || '').toLowerCase().includes(filterText.toLowerCase());
      const cats = c.categories || (c.category ? [c.category] : []);
      const matchesCat = filterCategory === 'All' || cats.includes(filterCategory);
      return matchesText && matchesCat;
    });

  const handleCsvImportSubmit = () => {
    if (!csvFile) return;
    setCsvImporting(true);
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        if (!results.data || !results.data.length) {
          alert('CSV is empty');
          setCsvImporting(false);
          return;
        }
        const headers = results.meta.fields || [];
        const isTwoCol = headers.length === 2 && headers.includes('name') && headers.includes('address');
        const isSevenCol = headers.length === 7 && headers.includes('name') && headers.includes('address') && headers.includes('phone') && headers.includes('category') && headers.includes('status') && headers.includes('assignto') && headers.includes('notes');
        const isNoHeaderTwoCol = !results.meta.fields && Object.keys(results.data[0]).length === 2;
        const isNoHeaderSevenCol = !results.meta.fields && Object.keys(results.data[0]).length === 7;

        if (!isTwoCol && !isSevenCol && !isNoHeaderTwoCol && !isNoHeaderSevenCol) {
          alert("Columns should be name, address, phone, category, status, assignto, and notes. Only name and address are required.");
          setCsvImporting(false);
          return;
        }

        const rowsToProcess = results.data.map((row: any) => {
          if (isNoHeaderTwoCol || isNoHeaderSevenCol) {
            const vals = Object.values(row);
            return {
              name: vals[0], address: vals[1],
              phone: vals[2] || '', category: vals[3] || '',
              status: vals[4] || 'Unvisited', assignto: vals[5] || '', notes: vals[6] || ''
            };
          } else {
            return {
              name: row.name, address: row.address,
              phone: row.phone || '', category: row.category || '',
              status: row.status || 'Unvisited', assignto: row.assignto || '', notes: row.notes || ''
            };
          }
        });

        try {
          const res = await axios.post('api/locations/import-csv', { rows: rowsToProcess });
          setCsvImportResults(res.data);
          onUpdate();
        } catch (err: any) {
          alert(err.response?.data?.message || 'CSV Import failed');
        } finally {
          setCsvImporting(false);
        }
      },
      error: (err: any) => {
        alert('Failed to parse CSV: ' + err.message);
        setCsvImporting(false);
      }
    });
  };

  const handleManualSubmit = async () => {
    let dataToSave = { ...manualData };
    if (dataToSave.lat === 38.0406) {
      try {
        const res = await axios.post('api/locations/geocode', { address: dataToSave.address });
        dataToSave.lat = res.data.lat;
        dataToSave.lng = res.data.lng;
        dataToSave.address = res.data.formatted_address;
      } catch (err: any) {
        alert('Could not find exact location for this address. Please ensure the address is correct, or select an option from the autocomplete list.');
        return;
      }
    }

    try {
      await axios.post('api/locations', dataToSave);
      setShowManualAdd(false);
      setManualData({
        name: '', address: '', phone: '', category: '', status: 'Unvisited', assigned_volunteer_id: '', notes: '', lat: 38.0406, lng: -84.5037
      });
      onUpdate();
    } catch (err) {
      alert('Failed to add location');
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setManualData((prev: any) => ({
          ...prev,
          address: `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`,
          lat: latitude,
          lng: longitude
        }));
      },
      () => {
        alert('Unable to retrieve your location');
      }
    );
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div className="button-group" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setShowImport(true)}>Import by Category</button>
        <button onClick={() => navigate('/map', { state: { activeTool: 'ImportRectangle' } })}>Import by Area</button>
        {user?.role === 'Application Administrator' && (
          <button onClick={() => setShowCsvImport(true)}>Import from CSV</button>
        )}
        <button onClick={() => setShowManualAdd(true)}>Manually Add</button>
      </div>

      {showImport && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <button className="close-btn" onClick={() => { setShowImport(false); setCandidates([]); }}>&times;</button>
            <h3>Import from Google Places</h3>
            {!candidates.length ? (
              <>
                <div className="form-group">
                  <label>Category</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>City/State</label>
                  <input type="text" value={importCity} onChange={(e) => setImportCity(e.target.value)} />
                </div>
                {isImporting ? (
                  <p>Searching... Please wait.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleSearch}>Search</button>
                    <button className="secondary" onClick={() => setShowImport(false)}>Cancel</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="filter-toolbar">
                  <input 
                    type="text" 
                    placeholder="Filter results..." 
                    value={filterText} 
                    onChange={e => setFilterText(e.target.value)} 
                  />
                  <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="All">All Categories</option>
                    {[...new Set(candidates.flatMap(c => c.categories || (c.category ? [c.category] : [])))].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button onClick={() => setSelectedCandidates(new Set(filteredCandidates.map(c => c.originalIndex)))}>Select Filtered</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span>{selectedCandidates.size} of {candidates.length} selected</span>
                  <button className="secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={deselectAll}>Deselect All</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', marginBottom: '1rem', borderRadius: '4px' }}>
                  {filteredCandidates.map((c) => (
                    <div key={c.originalIndex} style={{ display: 'flex', gap: '1rem', padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedCandidates.has(c.originalIndex)} 
                        onChange={() => toggleCandidate(c.originalIndex)} 
                        style={{ width: 'auto' }}
                      />
                      <div>
                        <strong>{c.name}</strong><br />
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{c.address}</span><br />
                        <span style={{ fontSize: '0.8rem', color: '#999' }}>Category: {formatCategoryName(c.category || (c.categories && c.categories[0]))}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {isImporting ? (
                  <p>Importing... Please wait.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleConfirmImport}>Confirm Import</button>
                    <button className="secondary" onClick={() => { setShowImport(false); setCandidates([]); }}>Cancel</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showManualAdd && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '500px' }}>
            <button className="close-btn" onClick={() => setShowManualAdd(false)}>&times;</button>
            <h3>Manually Add Location</h3>
            <div className="form-group">
              <label>Name *</label>
              <input 
                type="text" 
                value={manualData.name} 
                onChange={e => setManualData({ ...manualData, name: e.target.value })} 
                placeholder="Business Name"
              />
            </div>
            <div className="form-group">
              <label>Address *</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                <div id="list-autocomplete-container" style={{ width: '100%', minHeight: '40px' }}>
                  <input 
                    type="text" 
                    value={manualData.address} 
                    onChange={e => setManualData({ ...manualData, address: e.target.value })} 
                    placeholder="Type address if suggestions don't appear..."
                    data-1p-ignore
                  />
                </div>
                <button onClick={useMyLocation} title="Use My Location" className="secondary" style={{ width: '100%', marginTop: '5px' }}>📍 Use My Current Location</button>
              </div>
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input 
                type="text" 
                value={manualData.phone} 
                onChange={e => setManualData({ ...manualData, phone: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={manualData.category} onChange={e => setManualData({ ...manualData, category: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={manualData.status} onChange={e => setManualData({ ...manualData, status: e.target.value })}>
                {statuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Assign to</label>
              <select 
                value={manualData.assigned_volunteer_id} 
                onChange={e => setManualData({ ...manualData, assigned_volunteer_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {volunteers.map(v => (
                  <option key={v.id} value={v.id}>{v.email}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea 
                placeholder="Enter notes..." 
                value={manualData.notes} 
                onChange={e => setManualData({ ...manualData, notes: e.target.value })} 
                style={{ width: '100%', minHeight: '60px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={handleManualSubmit} disabled={!manualData.name || !manualData.address}>Add Location</button>
              <button className="secondary" onClick={() => setShowManualAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showCsvImport && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '600px' }}>
            <button className="close-btn" onClick={() => { setShowCsvImport(false); setCsvImportResults(null); setCsvFile(null); }}>&times;</button>
            <h3 style={{ color: 'var(--primary)' }}>Import from CSV</h3>
            
            {!csvImportResults ? (
              <>
                <p>Columns should be <strong>name, address, phone, category, status, assignto, and notes</strong>. Only name and address are required.</p>
                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)} />
                </div>
                {csvImporting ? (
                  <p>Processing CSV... This may take a moment.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleCsvImportSubmit} disabled={!csvFile}>Import</button>
                    <button className="secondary" onClick={() => setShowCsvImport(false)}>Cancel</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p>Successfully imported <strong>{csvImportResults.successCount}</strong> locations.</p>
                
                {csvImportResults.ignoredRows?.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ color: 'orange' }}>Ignored (Already Exists): {csvImportResults.ignoredRows.length}</h4>
                    <ul style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.9em' }}>
                      {csvImportResults.ignoredRows.map((r: any, i: number) => (
                        <li key={i}>{r.name} - {r.address}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {csvImportResults.failedRows?.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ color: 'red' }}>Failed (Address Not Found): {csvImportResults.failedRows.length}</h4>
                    <ul style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.9em' }}>
                      {csvImportResults.failedRows.map((r: any, i: number) => (
                        <li key={i}>{r.name} - {r.address}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button onClick={() => { setShowCsvImport(false); setCsvImportResults(null); setCsvFile(null); }}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateImportActions;
