import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Download, Loader2, Info, MapPin, AlignLeft, Calendar, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadPreview, processJob, fetchJobRows } from '@/services/bulkUploadService';

const TEMPLATE_HEADERS = [
  'Entity', 'Asset ID', 'Asset Name', 'Asset Description',
  'Serial Number', 'Sub Number', 'Tag Number', 'Asset Class',
  'Asset Type', 'Sub Asset Type', 'Cost Center', 'Int. Order', 'Supplier', 'Currency',
  'Purchase Value', 'Useful Life', 'Useful Life in Periods', 'Capitalized On',
  'Location', 'Sub Location',
  'APC FY Start', 'Acquisition', 'Retirement', 'Transfer', 'Post-Capital.', 'Current APC',
  'Dep. FY Start', 'Dep. for Year', 'Dep. Retirement', 'Dep. Transfer', 'Write-ups',
  'Dep. Post-Cap.', 'Accumulated Dep.', 'Bk. Val. FY Start', 'Current Book Value', 'Deactivation On',
  'WFH UID', 'WFH User Name', 'WFH User Email', 'WFH Location',
];

const PREVIEW_COLUMNS = ['Entity', 'Asset ID', 'Asset Name', 'Asset Type', 'Sub Asset Type', 'Location', 'Sub Location'];

const PREVIEW_KEY_MAP: Record<string, string> = {
  'Entity': 'entity_code',
  'Asset ID': 'asset_id',
  'Asset Name': 'name',
  'Asset Type': 'category_code',
  'Sub Asset Type': 'sub_type_code',
  'Location': 'location_code',
  'Sub Location': 'sub_location_text',
};

interface PreviewRow {
  id?: string;
  row_number: number;
  raw_data: Record<string, string>;
  status: string;
  error_message?: string;
}

interface PreviewData {
  job_id?: string;
  total_rows: number;
  valid_rows: number;
  failed_rows: number;
  previewRows: PreviewRow[];
  errors: { row: number; message: string }[];
}

export default function BulkUploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processResult, setProcessResult] = useState<any>(null);
  const [jobRows, setJobRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMutation = useMutation({
    mutationFn: (f: File) => uploadPreview(f),
    onSuccess: (data) => {
      const previewRows: PreviewRow[] = (data.preview ?? []).map((r: any) => ({
        id: r.id,
        row_number: r.row_number,
        raw_data: r.raw_data ?? {},
        status: r.status,
        error_message: r.error_message,
      }));
      const errors: { row: number; message: string }[] = data.errors ?? [];
      const jid = data.job_id ?? null;
      setPreview({
        job_id: jid,
        total_rows: data.total_rows ?? 0,
        valid_rows: data.valid_rows ?? 0,
        failed_rows: data.failed_rows ?? 0,
        previewRows,
        errors,
      });
      if (jid) setJobId(jid);
      toast({ title: 'Preview Ready', description: `${data.total_rows ?? 0} rows parsed, ${data.valid_rows ?? 0} valid.` });
    },
    onError: (err: any) => {
      toast({ title: 'Preview Failed', description: err?.response?.data?.detail || 'Unable to parse file.', variant: 'destructive' });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const lowerName = f.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      toast({
        title: 'Unsupported File',
        description: 'Please upload a CSV or XLSX file. Legacy .xls files are not supported.',
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }
    setFile(f);
    setPreview(null);
    setProcessResult(null);
    setJobRows([]);
    previewMutation.mutate(f);
  };

  const handleDownloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'asset_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Fill in the CSV and upload it back.' });
  };

  const handleProcess = async () => {
    if (!jobId) return;
    setProcessing(true);
    setProcessProgress(10);
    try {
      const processResult = await processJob(jobId);
      setProcessProgress(100);
      setProcessResult(processResult);
      toast({
        title: 'Upload Complete',
        description: `${processResult.success_rows ?? 0} assets created, ${processResult.failed_rows ?? 0} failed.`,
      });
      try {
        const rowsData = await fetchJobRows(jobId);
        setJobRows(rowsData.results ?? rowsData ?? []);
      } catch {
        // rows fetch is non-critical; summary is still shown
      }
    } catch (err: any) {
      toast({ title: 'Processing Failed', description: err?.response?.data?.detail || 'Error during processing.', variant: 'destructive' });
    }
    setProcessing(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold">Bulk Asset Upload</h1>
      </div>

      {/* Pre-upload guidance */}
      <Card className="border-blue-200 bg-blue-50/40">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-sm font-semibold text-blue-800">Before You Upload</span>
            <span className="text-xs text-blue-600 ml-1">— use the template and read these rules to avoid failed rows</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">

            {/* Required columns */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <AlignLeft className="h-3 w-3" /> Required Columns
              </p>
              <p className="text-xs text-foreground/80">These three columns must be present and non-empty in every row:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Asset ID', 'Asset Type', 'Location'].map((col) => (
                  <span key={col} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Asset Name</span> is optional — if blank, the system falls back to Asset Description, then Asset ID.
              </p>
            </div>

            {/* Master data matching */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" /> Must Match System Records
              </p>
              <p className="text-xs text-foreground/80">When provided, these values must match active records already in the system:</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {['Asset Type', 'Location', 'Entity', 'Cost Center', 'Supplier', 'Sub Asset Type'].map((col) => (
                  <span key={col} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium">Sub Asset Type</span> must belong to the selected Asset Type.
              </p>
            </div>

            {/* Formats */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Formats
              </p>
              <p className="text-xs text-foreground/80">
                <span className="font-medium">Files:</span> CSV and XLSX only. Legacy <code className="bg-muted px-1 rounded">.xls</code> is not supported.
              </p>
              <p className="text-xs text-foreground/80">
                <span className="font-medium">Dates:</span>{' '}
                <code className="bg-muted px-1 rounded">YYYY-MM-DD</code>{' · '}
                <code className="bg-muted px-1 rounded">DD/MM/YYYY</code>{' · '}
                <code className="bg-muted px-1 rounded">MM/DD/YYYY</code>{' · '}
                <code className="bg-muted px-1 rounded">DD-MM-YYYY</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Template has {TEMPLATE_HEADERS.length} columns — only the required ones above are mandatory; the rest are optional.
              </p>
            </div>

            {/* Scope + template hint */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Scope &amp; Template
              </p>
              <p className="text-xs text-foreground/80">
                <span className="font-medium">Location Admins</span> can upload assets only for locations within their assigned hierarchy.
              </p>
              <p className="text-xs text-foreground/80">
                Always use the downloaded template and <span className="font-medium">keep header names unchanged</span>. Renaming headers will cause parsing errors.
              </p>
            </div>

          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Upload CSV or XLSX File</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm font-medium">{file.name}</p>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setProcessResult(null); }}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">Click to upload a CSV or XLSX file</p>
                <p className="text-xs text-muted-foreground mt-1">Template has {TEMPLATE_HEADERS.length} columns. Legacy `.xls` files are not supported.</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />

          {previewMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Parsing file...</div>
          )}

          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download Template ({TEMPLATE_HEADERS.length} columns)
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <>
          {preview.errors.length > 0 && (
            <Card className="border-destructive/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-2">
                  <AlertTriangle className="h-4 w-4" /> {preview.errors.length} validation error(s)
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Fix the rows listed below, then upload the file again. Invalid rows will not be processed.
                </p>
                {preview.errors.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-xs text-muted-foreground break-words">Row {err.row}: {err.message}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Preview ({preview.total_rows} rows — {preview.valid_rows} valid, {preview.failed_rows} with errors)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      {PREVIEW_COLUMNS.map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.previewRows.map((row) => {
                      const rd = row.raw_data || {};
                      const isInvalid = row.status === 'invalid' || row.status === 'INVALID';
                      return (
                        <TableRow key={row.row_number} className={isInvalid ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-xs">{row.row_number}</TableCell>
                          {PREVIEW_COLUMNS.map((col) => {
                            const mappedKey = PREVIEW_KEY_MAP[col];
                            const snakeKey = col.toLowerCase().replace(/ /g, '_');
                            const val = (mappedKey && rd[mappedKey]) || rd[col] || rd[snakeKey] || '';
                            return <TableCell key={col} className={`text-xs ${!val ? 'text-muted-foreground' : ''}`}>{val || '—'}</TableCell>;
                          })}
                          <TableCell>
                            {isInvalid ? (
                              <span className="flex items-start gap-1 max-w-[280px]">
                                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                <span className="text-xs text-destructive whitespace-normal break-words">{row.error_message}</span>
                              </span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {processing && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Processing assets...</span>
                  <span>{processProgress}%</span>
                </div>
                <Progress value={processProgress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {processResult && (
            <>
              <Card>
                <CardContent className="p-4 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="font-medium">Upload Complete</p>
                  <p className="text-sm text-muted-foreground">
                    Created: {processResult.success_rows ?? 0} &nbsp;|&nbsp; Failed: {processResult.failed_rows ?? 0}
                  </p>
                </CardContent>
              </Card>

              {jobRows.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Imported Rows ({jobRows.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-8">#</TableHead>
                            <TableHead className="text-xs">Asset ID</TableHead>
                            <TableHead className="text-xs">Asset UUID</TableHead>
                            <TableHead className="text-xs">QR UID</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Error</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobRows.map((row: any) => {
                            const isOk = row.status === 'imported' || row.status === 'IMPORTED';
                            return (
                              <TableRow key={row.row_number} className={!isOk ? 'bg-destructive/5' : ''}>
                                <TableCell className="text-xs">{row.row_number}</TableCell>
                                <TableCell className="text-xs font-mono">{row.asset_id_value || '—'}</TableCell>
                                <TableCell className="text-xs font-mono text-muted-foreground">{row.asset_uuid ? row.asset_uuid.slice(0, 8) + '…' : '—'}</TableCell>
                                <TableCell className="text-xs font-mono text-muted-foreground">{row.qr_uid ? row.qr_uid.slice(0, 8) + '…' : '—'}</TableCell>
                                <TableCell>
                                  {isOk
                                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    : <span className="text-xs text-destructive">{row.status}</span>}
                                </TableCell>
                                <TableCell className="text-xs text-destructive max-w-[260px] whitespace-normal break-words">{row.error_message || ''}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!processResult && (
            <Button onClick={handleProcess} disabled={processing || !jobId} className="w-full">
              {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {processing ? 'Processing...' : `Process ${preview.valid_rows} Valid Assets`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
