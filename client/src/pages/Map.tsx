import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Fix Leaflet marker icon issue
// @ts-ignore
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const getStatusColor = (status: string, assigned: boolean) => {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'aed located and mapped at aed.new - done') return 'gold';
  if (lowerStatus === 'unvisited' || lowerStatus === 'pending') return assigned ? 'blue' : 'gray';
  
  if (lowerStatus.endsWith('done')) return 'green';
  if (lowerStatus.endsWith('follow-up') || lowerStatus.endsWith('follow up')) return 'yellow';
  
  return 'gray';
};

const CustomMarkerIcon = (color: string, isTarget: boolean) => {
  if (isTarget) {
    return new L.DivIcon({
      className: 'custom-marker target',
      html: `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2" fill="white"/>
          <circle cx="12" cy="12" r="6" stroke="${color}" stroke-width="2"/>
          <circle cx="12" cy="12" r="2" fill="${color}"/>
        </svg>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12]
    });
  }
  return new L.DivIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const MapEvents = ({ onDrawCreated, onCircleCreated, selectedVolunteer }: { 
  onDrawCreated: (bounds: L.LatLngBounds) => void, 
  onCircleCreated: (center: L.LatLng, radius: number) => void,
  selectedVolunteer: string 
}) => {
  const map = useMap();

  useEffect(() => {
    map.pm.addControls({
      position: 'topleft',
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: false,
      drawCircle: true,
      drawMarker: false,
      drawText: false,
      cutPolygon: false,
      editMode: true,
      dragMode: true,
      removalMode: true,
    });

    map.on('pm:drawstart', (e: any) => {
      if ((e.shape === 'Rectangle' || e.shape === 'Circle') && !selectedVolunteer) {
        alert('Please select a volunteer first.');
        map.pm.disableDraw();
      }
    });

    map.on('pm:create', (e: any) => {
      if (e.shape === 'Rectangle') {
        const layer = e.layer;
        const bounds = layer.getBounds();
        onDrawCreated(bounds);
        // Optionally remove the layer after capturing bounds if we don't want it to stay
        // layer.remove(); 
      } else if (e.shape === 'Circle') {
        onCircleCreated(e.layer.getLatLng(), e.layer.getRadius());
        e.layer.remove(); // Remove temporary circle after search
      }
    });

    return () => {
      map.pm.removeControls();
      map.off('pm:create');
      map.off('pm:drawstart');
    };
  }, [map, onDrawCreated, selectedVolunteer]);

  return null;
};

const Map: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');
  const [userAssignments, setUserAssignments] = useState<any[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [importCity, setImportCity] = useState('Lexington, KY');
  const [isImporting, setIsImporting] = useState(false);
  
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<number>>(new Set());
  
  const [filterText, setFilterText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  const fetchLocations = async () => {
    try {
      const res = await axios.get('api/locations');
      setLocations(res.data);
    } catch (err) {
      console.error('Failed to fetch locations', err);
    }
  };

  const fetchVolunteers = async () => {
    if (['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user?.role || '')) {
      try {
        const res = await axios.get('api/users');
        const data = res.data;
        setVolunteers(data.filter((u: any) => u.role === 'Volunteer' || u.role === 'CHAARG leader'));
      } catch (err) {
        console.error('Failed to fetch volunteers', err);
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get('api/categories');
      setCategories(res.data);
      if (res.data.length > 0) setSelectedCategory(res.data[0]);
    } catch (err) {
      console.error('Failed to fetch categories', err);
    }
  };

  useEffect(() => {
    fetchLocations();
    fetchVolunteers();
    fetchCategories();
  }, [user]);

  useEffect(() => {
    if (selectedVolunteer) {
      axios.get(`api/assignments/${selectedVolunteer}`).then(res => {
        setUserAssignments(res.data);
      }).catch(err => {
        console.error('Failed to fetch user assignments', err);
      });
    } else {
      setUserAssignments([]);
    }
  }, [selectedVolunteer]);

  const handleAreaAssignment = async (bounds: L.LatLngBounds) => {
    if (!selectedVolunteer) {
      alert('Please select a volunteer first.');
      return;
    }

    try {
      const res = await axios.post('api/assignments/area', {
        volunteerId: selectedVolunteer,
        bounds: bounds
      });
      alert(`Assigned ${res.data.assignedCount} locations.`);
      fetchLocations();
      // Refetch assignments for the current volunteer to show the new rectangle
      const assignRes = await axios.get(`api/assignments/${selectedVolunteer}`);
      setUserAssignments(assignRes.data);
    } catch (err) {
      console.error('Failed to assign locations', err);
      alert('Failed to assign locations.');
    }
  };

  const handleCircleCreated = async (center: L.LatLng, radius: number) => {
    setIsImporting(true);
    setShowImport(true); // Open the unified modal
    setCandidates([]);
    try {
      const res = await axios.post('api/locations/search-nearby', {
        lat: center.lat,
        lng: center.lng,
        radius: radius
      });
      setCandidates(res.data);
      setSelectedCandidates(new Set(res.data.map((_: any, i: number) => i)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Nearby search failed.');
    } finally {
      setIsImporting(false);
    }
  };

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
      const res = await axios.post('api/locations/confirm-import', {
        locations: locationsToImport
      });
      alert(`Imported ${res.data.importedCount} locations.`);
      setShowImport(false);
      setCandidates([]);
      fetchLocations();
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
      const matchesText = c.name.toLowerCase().includes(filterText.toLowerCase()) || 
                          c.address.toLowerCase().includes(filterText.toLowerCase());
      const categories = c.categories || (c.category ? [c.category] : []);
      const matchesCat = filterCategory === 'All' || categories.includes(filterCategory);
      return matchesText && matchesCat;
    });

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2>Map View</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {['Application Administrator', 'City Coordinator'].includes(user?.role || '') && (
              <button onClick={() => setShowImport(true)}>Import Locations</button>
            )}
            {['Application Administrator', 'City Coordinator', 'CHAARG leader'].includes(user?.role || '') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label>Assign to:</label>
                <select value={selectedVolunteer} onChange={(e) => setSelectedVolunteer(e.target.value)}>
                  <option value="">Select Volunteer</option>
                  {volunteers.map(v => (
                    <option key={v.id} value={v.id}>{v.email} ({v.role})</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Draw rectangle to assign</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, height: '70vh', position: 'relative' }}>
        <MapContainer center={[38.0406, -84.5037]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {userAssignments.map((assign, i) => (
            <Rectangle 
              key={i} 
              bounds={[[assign.geom._southWest.lat, assign.geom._southWest.lng], [assign.geom._northEast.lat, assign.geom._northEast.lng]]}
              pathOptions={{ color: 'red', fillOpacity: 0.1 }}
            />
          ))}
          {locations.map(loc => {
            const isAssignedToSelected = selectedVolunteer && Number(loc.assigned_volunteer_id) === Number(selectedVolunteer);
            return (
              <Marker 
                key={loc.id} 
                position={[loc.lat, loc.lng]} 
                icon={CustomMarkerIcon(getStatusColor(loc.status, !!loc.assigned_volunteer_id), !!isAssignedToSelected)}
              >
                <Popup>
                  <strong>{loc.name}</strong><br />
                  {loc.address}<br />
                  Status: {loc.status}<br />
                  Assigned: {loc.assigned_volunteer_email || 'Unassigned'}<br />
                  <button onClick={() => navigate(`/locations/${loc.id}`)} style={{ padding: '2px 5px', fontSize: '0.8rem', marginTop: '5px' }}>
                    Details
                  </button>
                </Popup>
              </Marker>
            );
          })}
          <MapEvents 
            onDrawCreated={handleAreaAssignment} 
            onCircleCreated={handleCircleCreated}
            selectedVolunteer={selectedVolunteer} 
          />
        </MapContainer>
      </div>

      {showImport && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
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
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{c.address}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {isImporting ? (
                  <p>Importing... Please wait.</p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={handleConfirmImport}>Confirm Import</button>
                    <button className="secondary" onClick={() => setCandidates([])}>Back to Search</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;