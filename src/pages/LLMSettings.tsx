import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useProjects, useProjectLlmSettings, useUpdateProjectLlmSettings } from '@/api/hooks';
import type { LLMStepProfile, ProjectLLMSettings } from '@/api/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

const RECOMMENDED_PROFILES: Array<{ key: string; defaults: LLMStepProfile }> = [
  { key: 'phase1-style-sheet', defaults: { temperature: 0.2, maxTokens: 4000 } },
  { key: 'phase1-context-bundle', defaults: { temperature: 0.1, maxTokens: 7000 } },
  { key: 'phase1-context-bundle-revise', defaults: { temperature: 0.5, maxTokens: 8000 } },
  { key: 'phase2-series-outline', defaults: { temperature: 0.7, maxTokens: 8000 } },
  { key: 'phase2-series-outline-revise', defaults: { temperature: 0.5, maxTokens: 8000 } },
  { key: 'phase2-context-bundle-update', defaults: { temperature: 0.1, maxTokens: 9000 } },
  { key: 'phase3-call-sheet', defaults: { temperature: 0.4, maxTokens: 6000 } },
  { key: 'phase3-context-bundle-update', defaults: { temperature: 0.1, maxTokens: 9000 } },
  { key: 'phase4-characters', defaults: { temperature: 0.5, maxTokens: 7000 } },
  { key: 'phase4-worldbuilding', defaults: { temperature: 0.5, maxTokens: 8000 } },
  { key: 'phase4-context-bundle-update', defaults: { temperature: 0.1, maxTokens: 12000 } },
  { key: 'phase5-outline', defaults: { temperature: 0.6, maxTokens: 9000 } },
  { key: 'phase5-outline-revise', defaults: { temperature: 0.5, maxTokens: 9000 } },
  { key: 'phase5-context-bundle-update', defaults: { temperature: 0.1, maxTokens: 12000 } },
  { key: 'phase6-scene-brief', defaults: { temperature: 0.6, maxTokens: 5000 } },
  { key: 'phase6-first-draft', defaults: { temperature: 0.75, maxTokens: 12000 } },
  { key: 'phase6-improvement-plan', defaults: { temperature: 0.3, maxTokens: 5000 } },
  { key: 'phase6-apply-improvement-plan', defaults: { temperature: 0.6, maxTokens: 12000 } },
  { key: 'phase6-final-revise', defaults: { temperature: 0.55, maxTokens: 12000 } },
  { key: 'phase6-context-bundle-update', defaults: { temperature: 0.1, maxTokens: 12000 } },
  { key: 'phase7-compile', defaults: { temperature: 0.2, maxTokens: 16000 } },
];

function normalizeSettings(settings: ProjectLLMSettings | undefined): ProjectLLMSettings {
  return {
    default: settings?.default || {},
    profiles: settings?.profiles || {},
  };
}

function toNumberOrUndefined(value: string, kind: 'int' | 'float'): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = kind === 'int' ? Number.parseInt(trimmed, 10) : Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function updateProfileField(
  profile: LLMStepProfile,
  field: keyof LLMStepProfile,
  value: string
): LLMStepProfile {
  if (field === 'temperature') {
    return { ...profile, temperature: toNumberOrUndefined(value, 'float') };
  }
  if (field === 'maxTokens') {
    return { ...profile, maxTokens: toNumberOrUndefined(value, 'int') };
  }
  if (field === 'provider' || field === 'model') {
    const trimmed = value.trim();
    return { ...profile, [field]: trimmed ? trimmed : undefined };
  }
  return { ...profile, [field]: value };
}

export default function LLMSettings() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const selectedProjectId = searchParams.get('project') || projects?.[0]?.id;

  const { data: settings, isLoading: settingsLoading, error: settingsError } = useProjectLlmSettings(
    selectedProjectId || undefined
  );
  const updateMutation = useUpdateProjectLlmSettings(selectedProjectId || undefined);

  const normalized = useMemo(() => normalizeSettings(settings), [settings]);

  const [draft, setDraft] = useState<ProjectLLMSettings>(() => normalizeSettings(settings));
  const [newProfileKey, setNewProfileKey] = useState('');

  useEffect(() => {
    setDraft(normalizeSettings(settings));
  }, [settings]);

  const sortedProfileKeys = useMemo(() => {
    return Object.keys(draft.profiles || {}).sort((a, b) => a.localeCompare(b));
  }, [draft.profiles]);

  const setProject = (projectId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('project', projectId);
    setSearchParams(next);
  };

  const updateDefaultField = (field: keyof LLMStepProfile, value: string) => {
    setDraft((prev) => ({
      ...prev,
      default: updateProfileField(prev.default || {}, field, value),
    }));
  };

  const updateProfile = (key: string, field: keyof LLMStepProfile, value: string) => {
    setDraft((prev) => {
      const nextProfiles = { ...(prev.profiles || {}) };
      nextProfiles[key] = updateProfileField(nextProfiles[key] || {}, field, value);
      return { ...prev, profiles: nextProfiles };
    });
  };

  const deleteProfile = (key: string) => {
    const ok = window.confirm(`Delete profile "${key}"?`);
    if (!ok) return;

    setDraft((prev) => {
      const nextProfiles = { ...(prev.profiles || {}) };
      delete nextProfiles[key];
      return { ...prev, profiles: nextProfiles };
    });
  };

  const addProfile = () => {
    const key = newProfileKey.trim();
    if (!key) return;

    setDraft((prev) => {
      const nextProfiles = { ...(prev.profiles || {}) };
      if (nextProfiles[key]) return prev;
      nextProfiles[key] = {};
      return { ...prev, profiles: nextProfiles };
    });

    setNewProfileKey('');
  };

  const seedRecommendedProfiles = () => {
    setDraft((prev) => {
      const nextProfiles = { ...(prev.profiles || {}) };
      for (const item of RECOMMENDED_PROFILES) {
        if (!nextProfiles[item.key]) {
          nextProfiles[item.key] = { ...item.defaults };
        }
      }
      return { ...prev, profiles: nextProfiles };
    });
  };

  const handleSave = async () => {
    if (!selectedProjectId) return;

    try {
      await updateMutation.mutateAsync({
        default: draft.default,
        profiles: draft.profiles,
        replaceProfiles: true,
      });
      toast({
        title: 'Saved',
        description: 'LLM settings updated for this project.',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update LLM settings',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setDraft(normalized);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-4xl font-bold mb-2">
            <span className="gradient-text">LLM Settings</span>
          </h1>
          <p className="text-muted-foreground">
            Configure provider/model/temperature/max tokens per project, per workflow step.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Project</CardTitle>
            <CardDescription>Select which project you want to configure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Active project</Label>
            <Select
              value={selectedProjectId || ''}
              onValueChange={(v) => setProject(v)}
              disabled={projectsLoading || !projects || projects.length === 0}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {(projects || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {settingsError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-destructive font-medium">Failed to load LLM settings</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {settingsError instanceof Error ? settingsError.message : 'Unknown error'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default profile</CardTitle>
            <CardDescription>
              These values apply to all steps unless overridden by a per-step profile. Leaving provider/model blank
              falls back to your backend defaults.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input
                value={draft.default?.provider || ''}
                onChange={(e) => updateDefaultField('provider', e.target.value)}
                placeholder="openrouter"
                className="bg-muted/50 border-border"
                disabled={settingsLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={draft.default?.model || ''}
                onChange={(e) => updateDefaultField('model', e.target.value)}
                placeholder="google/gemini-2.0-flash-lite-preview-02-05"
                className="bg-muted/50 border-border"
                disabled={settingsLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.05"
                value={draft.default?.temperature ?? ''}
                onChange={(e) => updateDefaultField('temperature', e.target.value)}
                placeholder="0.7"
                className="bg-muted/50 border-border"
                disabled={settingsLoading}
              />
            </div>
            <div className="space-y-2">
              <Label>Max tokens</Label>
              <Input
                type="number"
                step="1"
                value={draft.default?.maxTokens ?? ''}
                onChange={(e) => updateDefaultField('maxTokens', e.target.value)}
                placeholder="8000"
                className="bg-muted/50 border-border"
                disabled={settingsLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={settingsLoading || updateMutation.isPending}
            >
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!selectedProjectId || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per-step profiles</CardTitle>
            <CardDescription>
              Edit the profile keys used by the workflows (for example: phase5-outline, phase4-characters,
              phase6-improvement-plan).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" onClick={seedRecommendedProfiles}>
                Add recommended profiles
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
              <div className="space-y-2">
                <Label>New profile key</Label>
                <Input
                  value={newProfileKey}
                  onChange={(e) => setNewProfileKey(e.target.value)}
                  placeholder="phase6-improvement-plan"
                  className="bg-muted/50 border-border"
                />
              </div>
              <Button variant="outline" onClick={addProfile} disabled={!newProfileKey.trim()}>
                Add profile
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile key</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Temperature</TableHead>
                  <TableHead>Max tokens</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProfileKeys.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No profiles defined yet.
                    </TableCell>
                  </TableRow>
                )}

                {sortedProfileKeys.map((key) => {
                  const p = draft.profiles[key] || {};
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{key}</TableCell>
                      <TableCell>
                        <Input
                          value={p.provider || ''}
                          onChange={(e) => updateProfile(key, 'provider', e.target.value)}
                          className="bg-muted/50 border-border"
                          placeholder="default"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={p.model || ''}
                          onChange={(e) => updateProfile(key, 'model', e.target.value)}
                          className="bg-muted/50 border-border"
                          placeholder="default"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.05"
                          value={p.temperature ?? ''}
                          onChange={(e) => updateProfile(key, 'temperature', e.target.value)}
                          className="bg-muted/50 border-border"
                          placeholder="0.6"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="1"
                          value={p.maxTokens ?? ''}
                          onChange={(e) => updateProfile(key, 'maxTokens', e.target.value)}
                          className="bg-muted/50 border-border"
                          placeholder="9000"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => deleteProfile(key)}
                          disabled={updateMutation.isPending}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={settingsLoading || updateMutation.isPending}
            >
              Reset
            </Button>
            <Button onClick={handleSave} disabled={!selectedProjectId || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppLayout>
  );
}
