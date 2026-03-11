import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScanLine, Package, MapPin, Camera, CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertTriangle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import LocationHierarchySelector from '@/components/LocationHierarchySelector';
import { LocationPath, LOCATION_LEVELS } from '@/types';
import { fetchAssets } from '@/services/assetService';
import { thirdPartyVerify, thirdPartyAddAsset, reconciliationSubmit } from '@/services/submissionService';
import { mapBackendAsset } from '@/services/mappers';
import type { Asset } from '@/types';

type Step = 'scan' | 'details' | 'location' | 'photo' | 'confirm' | 'success' | 'not_found' | 'add_asset';

export default function ReconciliationPage() {
  const [step, setStep] = useState<Step>('scan');
  const [code, setCode] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [locationPath, setLocationPath] = useState<LocationPath>({});
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isThirdParty = user?.role === 'third_party';

  const [newAssetName, setNewAssetName] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newAssetType, setNewAssetType] = useState('');
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const steps: Step[] = ['scan', 'details', 'location', 'photo', 'confirm', 'success'];
  const currentIndex = steps.indexOf(step);

  const handleSearch = async () => {
    if (!code.trim()) return;
    setSearchLoading(true);
    try {
      const resp = await fetchAssets({ search: code.trim(), page_size: 1 });
      if (resp.results?.length > 0) {
        setSelectedAsset(mapBackendAsset(resp.results[0]));
        setStep('details');
      } else {
        setStep(isThirdParty ? 'not_found' : 'not_found');
      }
    } catch {
      toast({ title: 'Search Error', description: 'Failed to search for asset.', variant: 'destructive' });
    }
    setSearchLoading(false);
  };

  const getLocationId = () => {
    const reversed = [...LOCATION_LEVELS].reverse();
    for (const lvl of reversed) {
      if (locationPath[lvl]) return locationPath[lvl];
    }
    return null;
  };

  const verifyMutation = useMutation({
    mutationFn: () => {
      const locationId = getLocationId();
      const fd = new FormData();
      fd.append('asset_id', selectedAsset!.id);
      if (locationId) fd.append('location_id', locationId);
      if (notes) fd.append('remarks', notes);
      if (photo) fd.append('photo', photo);
      return isThirdParty
        ? thirdPartyVerify(fd)
        : reconciliationSubmit(fd);
    },
    onSuccess: (data) => {
      setSubmissionResult(data);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['mySubmissions'] });
    },
    onError: (err: any) => {
      toast({ title: 'Submission Failed', description: err?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    },
  });

  const addAssetMutation = useMutation({
    mutationFn: () => {
      const locationId = getLocationId();
      const fd = new FormData();
      fd.append('asset_name', newAssetName);
      if (newSerialNumber) fd.append('serial_number', newSerialNumber);
      fd.append('asset_type_name', newAssetType);
      if (locationId) fd.append('location_id', locationId);
      if (notes) fd.append('remarks', notes);
      if (photo) fd.append('photo', photo);
      return thirdPartyAddAsset(fd);
    },
    onSuccess: (data) => {
      setSubmissionResult(data);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['mySubmissions'] });
      toast({ title: 'Asset Submitted for Approval' });
    },
    onError: (err: any) => {
      toast({ title: 'Submission Failed', description: err?.response?.data?.detail || 'Please try again.', variant: 'destructive' });
    },
  });

  const resetFlow = () => {
    setStep('scan');
    setCode('');
    setSelectedAsset(null);
    setLocationPath({});
    setNotes('');
    setPhoto(null);
    setNewAssetName('');
    setNewSerialNumber('');
    setNewAssetType('');
    setSubmissionResult(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setPhoto(e.target.files[0]);
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold">{isThirdParty ? 'Verify / Add Asset' : 'Reconciliation'}</h1>

      {!['success', 'not_found', 'add_asset'].includes(step) && (
        <div className="flex items-center gap-1 mb-4">
          {steps.slice(0, -1).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1.5 w-full rounded-full ${i <= currentIndex ? 'bg-accent' : 'bg-muted'}`} />
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'scan' && (
          <motion.div key="scan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="p-6 space-y-4 text-center">
                <ScanLine className="h-16 w-16 mx-auto text-accent" />
                <div>
                  <h2 className="text-lg font-semibold">Step 1: Scan Asset</h2>
                  <p className="text-sm text-muted-foreground">Scan the barcode or enter the asset ID</p>
                </div>
                <Input placeholder="Enter Asset ID, Tag, or Serial #" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="h-12 text-base text-center" />
                <Button onClick={handleSearch} disabled={searchLoading} className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground">
                  {searchLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />} Find Asset
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate('/scan')}>
                  <Camera className="mr-2 h-4 w-4" /> Use Camera Scanner
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'not_found' && (
          <motion.div key="not_found" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="p-6 space-y-4 text-center">
                <AlertTriangle className="h-16 w-16 mx-auto text-warning" />
                <div>
                  <h2 className="text-lg font-semibold">Asset Not Found</h2>
                  <p className="text-sm text-muted-foreground">No asset found for: <span className="font-mono font-bold">{code}</span></p>
                </div>
                <div className="flex flex-col gap-2">
                  {isThirdParty && (
                    <Button onClick={() => setStep('add_asset')} className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add New Asset Entry
                    </Button>
                  )}
                  <Button variant="outline" onClick={resetFlow} className="w-full"><ArrowLeft className="mr-2 h-4 w-4" /> Try Another Code</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'add_asset' && (
          <motion.div key="add_asset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <PlusCircle className="h-12 w-12 mx-auto text-accent mb-2" />
                  <h2 className="text-lg font-semibold">Add New Asset</h2>
                  <p className="text-sm text-muted-foreground">This will be submitted for admin approval</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1"><Label>Asset Name</Label><Input placeholder="e.g. HP Printer" value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Serial Number</Label><Input placeholder="e.g. SN-123456" value={newSerialNumber} onChange={(e) => setNewSerialNumber(e.target.value)} /></div>
                  <div className="space-y-1">
                    <Label>Asset Type *</Label>
                    <Select value={newAssetType} onValueChange={setNewAssetType}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {['Computer', 'Furniture', 'Vehicle', 'Networking', 'Security', 'Office Equipment'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Location *</Label><LocationHierarchySelector value={locationPath} onChange={setLocationPath} /></div>
                  <div className="space-y-1">
                    <Label>Photo</Label>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => fileRef.current?.click()}>
                      <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">{photo ? photo.name : 'Tap to take photo'}</p>
                    </div>
                  </div>
                  <div className="space-y-1"><Label>Remarks</Label><Textarea placeholder="Any observations..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('not_found')} className="flex-1"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
                  <Button onClick={() => addAssetMutation.mutate()} disabled={!newAssetType || Object.keys(locationPath).length === 0 || addAssetMutation.isPending} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                    {addAssetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Submit for Approval
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'details' && selectedAsset && (
          <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="text-center"><Package className="h-12 w-12 mx-auto text-accent mb-2" /><h2 className="text-lg font-semibold">Step 2: Verify Details</h2></div>
                <div className="space-y-2 bg-muted rounded-lg p-4 text-sm">
                  {[['Asset ID', selectedAsset.assetId], ['Name', selectedAsset.name], ['Serial', selectedAsset.serialNumber], ['Category', selectedAsset.category],
                    ...(isThirdParty ? [] : [['Assigned To', selectedAsset.assignedToName]])
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
                  ))}
                  {selectedAsset.locationBreadcrumb && (
                    <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Location:</p><p className="text-xs font-medium leading-relaxed">{selectedAsset.locationBreadcrumb}</p></div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('scan')} className="flex-1"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
                  <Button onClick={() => setStep('location')} className="flex-1">Confirm <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'location' && (
          <motion.div key="location" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="text-center"><MapPin className="h-12 w-12 mx-auto text-accent mb-2" /><h2 className="text-lg font-semibold">Step 3: Confirm Location</h2><p className="text-sm text-muted-foreground">Select the asset's current location</p></div>
                <LocationHierarchySelector value={locationPath} onChange={setLocationPath} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('details')} className="flex-1"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
                  <Button onClick={() => setStep('photo')} disabled={Object.keys(locationPath).length === 0} className="flex-1">Next <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'photo' && (
          <motion.div key="photo" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="text-center"><Camera className="h-12 w-12 mx-auto text-accent mb-2" /><h2 className="text-lg font-semibold">Step 4: Upload Photo</h2><p className="text-sm text-muted-foreground">Take a photo of the asset for verification</p></div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => fileRef.current?.click()}>
                  <Camera className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{photo ? photo.name : 'Tap to take photo or upload'}</p>
                </div>
                <Label>Notes (optional)</Label>
                <Textarea placeholder="Any observations..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('location')} className="flex-1"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
                  <Button onClick={() => setStep('confirm')} className="flex-1">Review <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'confirm' && selectedAsset && (
          <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-center">Step 5: Confirm Submission</h2>
                <div className="space-y-2 bg-muted rounded-lg p-4 text-sm">
                  {[['Asset', selectedAsset.name], ['ID', selectedAsset.assetId], ['Photo', photo ? 'Uploaded' : 'None'], ['Notes', notes || '—']].map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('photo')} className="flex-1"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
                  <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending} className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
                    {verifyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Submit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <h2 className="text-xl font-bold">{isThirdParty && !selectedAsset ? 'Submission Sent!' : 'Verification Complete!'}</h2>
                <p className="text-sm text-muted-foreground">
                  {isThirdParty && !selectedAsset ? 'Your new asset entry has been submitted for admin approval.' : 'Asset has been successfully reconciled.'}
                </p>
                {submissionResult?.tempRefId && (
                  <div className="rounded-lg bg-muted p-3 text-xs">
                    <p className="font-medium">Ref: <span className="font-mono">{submissionResult.tempRefId}</span></p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetFlow} className="flex-1">{isThirdParty ? 'Scan Another' : 'Verify Another'}</Button>
                  <Button onClick={() => navigate(isThirdParty ? '/submissions' : '/')} className="flex-1">{isThirdParty ? 'My Submissions' : 'Dashboard'}</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
