import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppLanguage, ThemeMode } from '../shared/types';
import type { NoteEntry } from '../features/workouts';
import { listNotes, replaceNotes } from '../features/notes';
import { formatRelativeDayLabel } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { resolveThemeTokens, type TreasyThemeTokens } from '../shared/theme/themes';
import { UNDO_TIMEOUT_MS } from '../shared/constants';
import { UndoToast } from '../shared/ui/UndoToast';
import { t } from '../shared/i18n/i18n';

type Props = {
  language: AppLanguage;
  themeMode?: ThemeMode;
  onBack: () => void;
};

type NoteGroup = {
  dateKey: string;
  label: string;
  notes: NoteEntry[];
};

type PendingDeleteState = null | {
  mode: 'single' | 'bulk';
  notes: NoteEntry[];
};

function localeFor(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function formatDateHeader(dateKey: string, language: AppLanguage): string {
  const unknownDateLabel = t(language, 'notert.unknownDate');
  if (dateKey === 'unknown') {
    return unknownDateLabel;
  }
  const dt = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(dt.getTime())) {
    return unknownDateLabel;
  }
  const relative = formatRelativeDayLabel(dt, new Date(), language);
  if (relative) return relative;
  return dt.toLocaleDateString(localeFor(language), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value: string, language: AppLanguage): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString(localeFor(language), { hour: '2-digit', minute: '2-digit' });
}

function parseHexColor(color: string): [number, number, number] | null {
  const clean = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function toRgba(color: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const rgb = parseHexColor(color) ?? [79, 142, 232];
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
}

function sourceLabel(source: NoteEntry['source'], language: AppLanguage): string {
  if (source === 'quicklog') {
    return t(language, 'notert.source.quicklog');
  }
  if (source === 'home_notes') {
    return t(language, 'notert.source.home');
  }
  return t(language, 'notert.source.other');
}

function withLeadingDashOnFirstLine(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const [firstLine, ...restLines] = trimmed.split('\n');
  const cleanFirst = firstLine.trim();
  const prefixedFirst = cleanFirst.startsWith('-') ? cleanFirst : `- ${cleanFirst}`;
  return [prefixedFirst, ...restLines].join('\n');
}

export const NotertScreen: React.FC<Props> = ({ language, themeMode, onBack }) => {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);
  const [deletedNotes, setDeletedNotes] = useState<NoteEntry[] | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeTokens = useMemo(() => resolveThemeTokens(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);
  const modalPlaceholderColor = toRgba(themeTokens.textMuted, 0.95);

  useEffect(() => {
    let alive = true;
    (async () => {
      const loaded = await listNotes();
      if (!alive) return;
      setNotes(loaded);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo<NoteGroup[]>(() => {
    const sorted = notes.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const groups: NoteGroup[] = [];
    for (const note of sorted) {
      const dateKey = typeof note.createdAt === 'string' && note.createdAt.length >= 10 ? note.createdAt.slice(0, 10) : 'unknown';
      const last = groups[groups.length - 1];
      if (!last || last.dateKey !== dateKey) {
        groups.push({
          dateKey,
          label: formatDateHeader(dateKey, language),
          notes: [note],
        });
      } else {
        last.notes.push(note);
      }
    }
    return groups;
  }, [language, notes]);

  const emptyLabel = t(language, 'notert.empty');
  const emptySubtitleLabel = t(language, 'notert.empty.subtitle');
  const loadingLabel = t(language, 'notert.loading');
  const deletingLabel = t(language, 'notert.deleting');
  const emptyNotePreview = t(language, 'notert.emptyNote');
  const titleLabel = t(language, 'notert.title');
  const screenSubtitle = t(language, 'notert.subtitle');
  const doneLabel = t(language, 'notert.done');
  const selectDeleteLabel = t(language, 'delete');
  const selectEditLabel = t(language, 'notert.edit');
  const saveLabel = t(language, 'notert.save');
  const selectedCount = selectedNoteIds.length;
  const selectedNote = selectedCount === 1 ? notes.find((note) => note.id === selectedNoteIds[0]) ?? null : null;
  const menuNote = menuNoteId ? notes.find((note) => note.id === menuNoteId) ?? null : null;
  const editModeTitle =
    editMode ? t(language, 'notert.selectedCount', { count: selectedCount }) : titleLabel;
  const isBulkPendingDelete = pendingDelete?.mode === 'bulk';
  const pendingDeleteCount = pendingDelete?.notes.length ?? 0;
  const deleteConfirmTitle = isBulkPendingDelete
    ? t(language, 'notert.delete.bulkTitle', { count: pendingDeleteCount })
    : t(language, 'notert.delete.singleTitle');
  const deleteConfirmBody = t(language, 'notert.delete.body');
  const deletePreviewLabel = isBulkPendingDelete
    ? t(language, 'notert.delete.preview.bulk')
    : t(language, 'notert.delete.preview.single');
  const deletedLabel =
    deletedNotes && deletedNotes.length > 1
      ? t(language, 'notert.delete.bulkDone', { count: deletedNotes.length })
      : t(language, 'notert.delete.singleDone');

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearUndoTimer();
    };
  }, [clearUndoTimer]);

  useEffect(() => {
    setSelectedNoteIds((prev) => prev.filter((id) => notes.some((note) => note.id === id)));
  }, [notes]);

  useEffect(() => {
    if (!menuNoteId) return;
    if (notes.some((note) => note.id === menuNoteId)) return;
    setMenuNoteId(null);
  }, [menuNoteId, notes]);

  useEffect(() => {
    if (notes.length > 0) return;
    setEditMode(false);
    setSelectedNoteIds([]);
  }, [notes.length]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedNoteIds([]);
    setMenuNoteId(null);
    setEditingNoteId(null);
    setEditingText('');
  }, []);

  const enterEditMode = useCallback(
    (noteId: string) => {
      if (deleteBusy) return;
      setEditMode(true);
      setSelectedNoteIds((prev) => {
        if (prev.includes(noteId)) return prev;
        if (editMode) return [...prev, noteId];
        return [noteId];
      });
    },
    [deleteBusy, editMode]
  );

  const toggleSelectedNote = useCallback((noteId: string) => {
    setSelectedNoteIds((prev) => (prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]));
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleteBusy) return;
    setPendingDelete(null);
  }, [deleteBusy]);

  const handleDeleteNotes = useCallback(
    async (entries: NoteEntry[], mode: 'single' | 'bulk') => {
      if (!entries.length || deleteBusy) return;

      const ids = new Set(entries.map((note) => note.id));
      const nextNotes = notes.filter((entry) => !ids.has(entry.id));
      try {
        setDeleteBusy(true);

        setNotes(nextNotes);
        await replaceNotes(nextNotes);

        setPendingDelete(null);
        setDeletedNotes(entries);
        clearUndoTimer();
        undoTimerRef.current = setTimeout(() => {
          setDeletedNotes(null);
          undoTimerRef.current = null;
        }, UNDO_TIMEOUT_MS);

        if (mode === 'bulk') {
          setEditMode(false);
          setSelectedNoteIds([]);
        }
      } catch (e) {
        console.warn('Failed to delete note(s)', e);
      } finally {
        setDeleteBusy(false);
      }
    },
    [clearUndoTimer, deleteBusy, notes]
  );

  const handleUndoDelete = useCallback(async () => {
    if (!deletedNotes?.length) return;
    const toRestore = deletedNotes;
    setDeletedNotes(null);
    clearUndoTimer();

    try {
      const merged = new Map<string, NoteEntry>();
      notes.forEach((note) => merged.set(note.id, note));
      toRestore.forEach((note) => merged.set(note.id, note));
      const restored = Array.from(merged.values());
      setNotes(restored);
      await replaceNotes(restored);
    } catch (e) {
      console.warn('Failed to restore deleted notes', e);
    }
  }, [clearUndoTimer, deletedNotes, notes]);

  const openBulkDeleteModal = useCallback(() => {
    if (!selectedNoteIds.length || deleteBusy) return;
    const selectedSet = new Set(selectedNoteIds);
    const entries = notes.filter((note) => selectedSet.has(note.id));
    if (!entries.length) return;
    setPendingDelete({ mode: 'bulk', notes: entries });
  }, [deleteBusy, notes, selectedNoteIds]);

  const openEditModalForSelected = useCallback(() => {
    if (!selectedNote || deleteBusy) return;
    setEditingNoteId(selectedNote.id);
    setEditingText(selectedNote.text);
  }, [deleteBusy, selectedNote]);

  const openNoteMenu = useCallback(
    (noteId: string) => {
      if (deleteBusy || editSaving) return;
      setMenuNoteId(noteId);
    },
    [deleteBusy, editSaving]
  );

  const closeNoteMenu = useCallback(() => {
    if (deleteBusy || editSaving) return;
    setMenuNoteId(null);
  }, [deleteBusy, editSaving]);

  const openDeleteModalForMenuNote = useCallback(() => {
    if (!menuNote || deleteBusy) return;
    setMenuNoteId(null);
    setPendingDelete({ mode: 'single', notes: [menuNote] });
  }, [deleteBusy, menuNote]);

  const openEditModalForMenuNote = useCallback(() => {
    if (!menuNote || deleteBusy) return;
    setMenuNoteId(null);
    setEditingNoteId(menuNote.id);
    setEditingText(menuNote.text);
  }, [deleteBusy, menuNote]);

  const closeEditModal = useCallback(() => {
    if (editSaving) return;
    setEditingNoteId(null);
    setEditingText('');
  }, [editSaving]);

  const handleSaveEditedNote = useCallback(async () => {
    if (!editingNoteId || editSaving) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;

    try {
      setEditSaving(true);
      const nextNotes = notes.map((entry) => (entry.id === editingNoteId ? { ...entry, text: trimmed } : entry));
      setNotes(nextNotes);
      await replaceNotes(nextNotes);
      setEditingNoteId(null);
      setEditingText('');
      setEditMode(false);
      setSelectedNoteIds([]);
    } catch (e) {
      console.warn('Failed to save edited note', e);
    } finally {
      setEditSaving(false);
    }
  }, [editSaving, editingNoteId, editingText, notes]);

  const pendingPreviewRaw = pendingDelete?.notes
    .map((note) => note.text.trim())
    .filter((text) => text.length > 0)
    .slice(0, 2)
    .join(' | ');
  const pendingPreviewSuffix = pendingDelete && pendingDelete.notes.length > 2 ? ` (+${pendingDelete.notes.length - 2})` : '';
  const pendingPreviewCombined = `${pendingPreviewRaw}${pendingPreviewSuffix}`;
  const modalPreviewText =
    pendingPreviewCombined.length === 0
      ? emptyNotePreview
      : pendingPreviewCombined.length > 84
        ? `${pendingPreviewCombined.slice(0, 81)}...`
        : pendingPreviewCombined;
  const anyDeleteBusy = deleteBusy;
  const modalDeleteBusy = deleteBusy;

  const renderEmpty = () => (
    <View style={styles.emptyStateWrap}>
      <View style={styles.emptyStateCard}>
        <Text style={styles.emptyStateIcon}>{'\u2726'}</Text>
        <Text style={styles.emptyStateTitle}>{emptyLabel}</Text>
        <Text style={styles.emptyStateSubtitle}>{emptySubtitleLabel}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.bgOrbTop} />
      <View pointerEvents="none" style={styles.bgOrbBottom} />

      <View style={styles.headerShell}>
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={editMode ? exitEditMode : onBack}
            hitSlop={12}
            style={styles.backPill}
            activeOpacity={0.8}
          >
            <Text style={styles.backText}>{editMode ? doneLabel : t(language, 'back')}</Text>
          </TouchableOpacity>
          {editMode ? <Text style={styles.modeFlag}>{t(language, 'notert.mode.select')}</Text> : null}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{editModeTitle}</Text>
        </View>
        {!editMode ? <Text style={styles.subtitle}>{screenSubtitle}</Text> : null}
        {editMode ? (
          <View style={styles.editActionRow}>
            {selectedCount === 1 ? (
              <TouchableOpacity
                style={[styles.editActionButton, (anyDeleteBusy || editSaving) ? styles.actionDisabled : null]}
                onPress={openEditModalForSelected}
                activeOpacity={0.86}
                disabled={anyDeleteBusy || editSaving}
              >
                <Text style={styles.editActionText}>{selectEditLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.deleteActionButton, (!selectedCount || anyDeleteBusy) ? styles.actionDisabled : null]}
              onPress={openBulkDeleteModal}
              activeOpacity={0.86}
              disabled={!selectedCount || anyDeleteBusy}
            >
              <Text style={styles.deleteActionText}>{selectDeleteLabel}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingStateWrap}>
          <View style={styles.loadingStateCard}>
            <Text style={styles.loadingText}>{loadingLabel}</Text>
          </View>
        </View>
      ) : grouped.length === 0 ? (
        renderEmpty()
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {grouped.map((group) => (
            <View key={group.dateKey} style={styles.daySection}>
              <View style={styles.dayHeaderRow}>
                <Text style={styles.dayHeader}>{group.label}</Text>
              </View>

              <View style={styles.dayTimelineWrap}>
                <View style={styles.dayTimelineLine} />
                {group.notes.map((note) => {
                  const isSelected = selectedNoteIds.includes(note.id);
                  const timeText = formatTime(note.createdAt, language) || '--:--';
                  const trimmedText = note.text.trim();
                  const basePreviewText = trimmedText.length > 0 ? trimmedText : emptyNotePreview;
                  const previewText =
                    note.source === 'quicklog' && trimmedText.length > 0 ? withLeadingDashOnFirstLine(trimmedText) : basePreviewText;
                  return (
                    <Pressable
                      key={note.id}
                      onLongPress={() => enterEditMode(note.id)}
                      delayLongPress={220}
                      onPress={() => {
                        if (!editMode) return;
                        toggleSelectedNote(note.id);
                      }}
                      style={({ pressed }) => [
                        styles.noteRow,
                        pressed ? styles.noteRowPressed : null,
                      ]}
                    >
                      <View style={[styles.noteDot, isSelected ? styles.noteDotSelected : null]} />
                      <View
                        style={[
                          styles.noteCard,
                          editMode ? styles.noteCardSelectable : null,
                          isSelected ? styles.noteCardSelected : null,
                        ]}
                      >
                        <View style={styles.noteTopRow}>
                          <View style={styles.noteMetaLeft}>
                            <Text style={styles.noteTimePill}>{timeText}</Text>
                            <Text style={styles.noteSource}>{sourceLabel(note.source, language)}</Text>
                          </View>
                          {editMode ? (
                            <View style={[styles.noteSelectCircle, isSelected ? styles.noteSelectCircleActive : null]}>
                              <Text style={styles.noteSelectMark}>{isSelected ? '\u2713' : ''}</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              hitSlop={8}
                              style={[styles.noteMenuButton, anyDeleteBusy ? styles.actionDisabled : null]}
                              onPress={() => {
                                openNoteMenu(note.id);
                              }}
                              activeOpacity={0.75}
                              disabled={anyDeleteBusy}
                              accessibilityLabel={t(language, 'notert.menu.more')}
                            >
                              <Text style={styles.noteMenuText}>{'\u22EE'}</Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <Text style={styles.noteText}>{previewText}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={Boolean(menuNote)} transparent animationType="fade" onRequestClose={closeNoteMenu}>
        <Pressable style={styles.modalBackdrop} onPress={closeNoteMenu}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t(language, 'notert.menu.title')}</Text>
            <View style={styles.menuActions}>
              <TouchableOpacity
                style={[styles.menuActionButton, (anyDeleteBusy || editSaving) ? styles.actionDisabled : null]}
                onPress={openEditModalForMenuNote}
                activeOpacity={0.9}
                disabled={anyDeleteBusy || editSaving}
              >
                <Text style={styles.menuActionText}>{t(language, 'notert.menu.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuDeleteButton, anyDeleteBusy ? styles.actionDisabled : null]}
                onPress={openDeleteModalForMenuNote}
                activeOpacity={0.9}
                disabled={anyDeleteBusy}
              >
                <Text style={styles.menuDeleteText}>{t(language, 'notert.menu.delete')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCancelButton, (anyDeleteBusy || editSaving) ? styles.actionDisabled : null]}
                onPress={closeNoteMenu}
                activeOpacity={0.9}
                disabled={anyDeleteBusy || editSaving}
              >
                <Text style={styles.modalCancelText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(pendingDelete)} transparent animationType="fade" onRequestClose={closeDeleteModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeDeleteModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{deleteConfirmTitle}</Text>
            <Text style={styles.modalBody}>{deleteConfirmBody}</Text>
            <Text style={styles.modalPreviewLabel}>{deletePreviewLabel}</Text>
            <Text style={styles.modalPreviewText} numberOfLines={2}>
              {modalPreviewText}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, anyDeleteBusy ? styles.actionDisabled : null]}
                onPress={closeDeleteModal}
                activeOpacity={0.9}
                disabled={anyDeleteBusy}
              >
                <Text style={styles.modalCancelText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteButton, modalDeleteBusy ? styles.actionDisabled : null]}
                onPress={() => {
                  if (!pendingDelete) return;
                  void handleDeleteNotes(pendingDelete.notes, pendingDelete.mode);
                }}
                activeOpacity={0.9}
                disabled={!pendingDelete || anyDeleteBusy}
              >
                <Text style={styles.modalDeleteText}>{modalDeleteBusy ? deletingLabel : t(language, 'delete')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(editingNoteId)} transparent animationType="fade" onRequestClose={closeEditModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeEditModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{selectEditLabel}</Text>
            <Text style={styles.modalBody}>{t(language, 'notert.edit.help')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editingText}
              onChangeText={setEditingText}
              multiline
              autoFocus
              editable={!editSaving}
              placeholder={emptyNotePreview}
              placeholderTextColor={modalPlaceholderColor}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, editSaving ? styles.actionDisabled : null]}
                onPress={closeEditModal}
                activeOpacity={0.9}
                disabled={editSaving}
              >
                <Text style={styles.modalCancelText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, (editSaving || editingText.trim().length === 0) ? styles.actionDisabled : null]}
                onPress={() => {
                  void handleSaveEditedNote();
                }}
                activeOpacity={0.9}
                disabled={editSaving || editingText.trim().length === 0}
              >
                <Text style={styles.modalSaveText}>{saveLabel}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View pointerEvents="box-none" style={styles.toastContainer}>
        <UndoToast
          visible={Boolean(deletedNotes?.length)}
          message={deletedLabel}
          actionLabel={t(language, 'undo')}
          onAction={() => {
            void handleUndoDelete();
          }}
        />
      </View>
    </SafeAreaView>
  );
};

function createStyles(themeTokens: TreasyThemeTokens) {
  const isLightTheme = themeTokens.id === 'calmLight';
  const shellShadow = toRgba(themeTokens.bg, isLightTheme ? 0.12 : 0.34);
  const cardShadow = toRgba(themeTokens.bg, isLightTheme ? 0.08 : 0.24);
  const dangerText = themeTokens.momentumDown;
  const dangerBg = toRgba(themeTokens.momentumDown, isLightTheme ? 0.18 : 0.24);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeTokens.bg,
      paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
      overflow: 'hidden',
      ...Platform.select({
        web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
      }),
    },
    bgOrbTop: {
      position: 'absolute',
      top: -90,
      right: -80,
      width: 280,
      height: 280,
      borderRadius: 999,
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.08 : 0.14),
    },
    bgOrbBottom: {
      position: 'absolute',
      bottom: -120,
      left: -100,
      width: 280,
      height: 280,
      borderRadius: 999,
      backgroundColor: toRgba(themeTokens.link, isLightTheme ? 0.1 : 0.16),
    },
    headerShell: {
      marginHorizontal: SCREEN_PADDING,
      marginBottom: SPACING.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.surface, isLightTheme ? 0.95 : 0.9),
      ...Platform.select({
        web: { boxShadow: `0 20px 30px ${shellShadow}` },
        default: {
          shadowColor: shellShadow,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6,
        },
      }),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
      minHeight: 34,
    },
    backPill: {
      minHeight: 34,
      borderRadius: RADIUS.pill,
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.18 : 0.22),
      paddingHorizontal: SPACING.md,
      justifyContent: 'center',
    },
    backText: {
      color: themeTokens.link,
      fontSize: TEXT.sm,
      fontWeight: '700',
    },
    modeFlag: {
      color: themeTokens.link,
      fontSize: TEXT.xs,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    title: {
      flex: 1,
      color: themeTokens.text,
      fontSize: TEXT.xxl,
      fontWeight: '900',
      letterSpacing: -0.4,
    },
    subtitle: {
      marginTop: 4,
      color: themeTokens.textMuted,
      fontSize: TEXT.sm,
      fontWeight: '500',
    },
    editActionRow: {
      marginTop: SPACING.md,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
    },
    editActionButton: {
      minHeight: 38,
      borderRadius: RADIUS.md,
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.18 : 0.24),
      paddingHorizontal: SPACING.md,
      justifyContent: 'center',
    },
    editActionText: {
      color: isLightTheme ? themeTokens.text : themeTokens.textOnAccent,
      fontSize: TEXT.sm,
      fontWeight: '800',
    },
    deleteActionButton: {
      minHeight: 38,
      borderRadius: RADIUS.md,
      backgroundColor: dangerBg,
      paddingHorizontal: SPACING.md,
      justifyContent: 'center',
    },
    deleteActionText: {
      color: dangerText,
      fontSize: TEXT.sm,
      fontWeight: '800',
    },
    actionDisabled: {
      opacity: 0.58,
    },
    loadingStateWrap: {
      flex: 1,
      paddingHorizontal: SCREEN_PADDING,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingStateCard: {
      width: '100%',
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.surface, isLightTheme ? 0.86 : 0.9),
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.lg,
      alignItems: 'center',
    },
    loadingText: {
      color: themeTokens.link,
      fontSize: TEXT.sm,
      fontWeight: '700',
    },
    emptyStateWrap: {
      flex: 1,
      paddingHorizontal: SCREEN_PADDING,
      justifyContent: 'center',
    },
    emptyStateCard: {
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.surface, isLightTheme ? 0.9 : 0.94),
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.xxl,
      alignItems: 'center',
    },
    emptyStateIcon: {
      color: themeTokens.accent,
      fontSize: 28,
      marginBottom: SPACING.sm,
    },
    emptyStateTitle: {
      color: themeTokens.text,
      fontSize: TEXT.lg,
      fontWeight: '900',
    },
    emptyStateSubtitle: {
      marginTop: SPACING.sm,
      color: themeTokens.textMuted,
      fontSize: TEXT.sm,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: 20,
    },
    scrollContent: {
      paddingHorizontal: SCREEN_PADDING,
      paddingBottom: SPACING.xxxl + SPACING.lg,
    },
    daySection: {
      marginBottom: SPACING.lg,
    },
    dayHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    dayHeader: {
      color: themeTokens.link,
      fontSize: TEXT.sm,
      fontWeight: '900',
      textTransform: 'capitalize',
    },
    dayTimelineWrap: {
      position: 'relative',
      paddingLeft: SPACING.md,
      gap: SPACING.sm,
    },
    dayTimelineLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 7,
      width: 1,
      backgroundColor: toRgba(themeTokens.stroke, isLightTheme ? 0.7 : 0.9),
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    noteRowPressed: {
      opacity: 0.88,
    },
    noteDot: {
      marginTop: 14,
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: themeTokens.accent,
    },
    noteDotSelected: {
      backgroundColor: themeTokens.success,
    },
    noteCard: {
      flex: 1,
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.surface, isLightTheme ? 0.96 : 0.93),
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: SPACING.xs,
      ...Platform.select({
        web: { boxShadow: `0 12px 22px ${cardShadow}` },
        default: {
          shadowColor: cardShadow,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        },
      }),
    },
    noteCardSelectable: {
      paddingLeft: SPACING.sm + 2,
    },
    noteCardSelected: {
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.2 : 0.34),
    },
    noteTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    noteMetaLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      minWidth: 0,
      flex: 1,
    },
    noteTimePill: {
      color: themeTokens.text,
      fontSize: TEXT.xs,
      fontWeight: '800',
      borderRadius: RADIUS.pill,
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.14 : 0.24),
      overflow: 'hidden',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
    },
    noteSource: {
      color: themeTokens.textMuted,
      fontSize: TEXT.xs,
      fontWeight: '700',
      flexShrink: 1,
    },
    noteMenuButton: {
      minHeight: 30,
      borderRadius: RADIUS.pill,
      backgroundColor: toRgba(themeTokens.surfaceAlt, isLightTheme ? 0.78 : 0.74),
      paddingHorizontal: SPACING.sm + 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noteMenuText: {
      color: themeTokens.textMuted,
      fontSize: TEXT.xs,
      fontWeight: '900',
      lineHeight: TEXT.xs + 2,
    },
    noteSelectCircle: {
      minWidth: 24,
      minHeight: 24,
      borderRadius: RADIUS.pill,
      backgroundColor: toRgba(themeTokens.surfaceAlt, isLightTheme ? 0.85 : 0.78),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    noteSelectCircleActive: {
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.28 : 0.38),
    },
    noteSelectMark: {
      color: isLightTheme ? themeTokens.text : themeTokens.textOnAccent,
      fontSize: TEXT.xs,
      fontWeight: '900',
      lineHeight: TEXT.xs + 1,
    },
    noteText: {
      color: themeTokens.text,
      fontSize: TEXT.sm,
      fontWeight: '600',
      lineHeight: 21,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: toRgba(themeTokens.bg, isLightTheme ? 0.46 : 0.78),
      justifyContent: 'center',
      paddingHorizontal: SCREEN_PADDING,
    },
    modalCard: {
      backgroundColor: toRgba(themeTokens.surface, isLightTheme ? 0.98 : 0.96),
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
      ...Platform.select({
        web: { maxWidth: 540, width: '100%', alignSelf: 'center', boxShadow: `0 24px 38px ${shellShadow}` },
        default: undefined,
      }),
    },
    modalTitle: {
      color: themeTokens.text,
      fontSize: TEXT.md,
      fontWeight: '900',
    },
    modalBody: {
      color: themeTokens.textMuted,
      fontSize: TEXT.sm,
      fontWeight: '600',
      lineHeight: 20,
    },
    modalPreviewLabel: {
      color: themeTokens.link,
      fontSize: TEXT.xs,
      fontWeight: '800',
      marginTop: SPACING.xs,
    },
    modalPreviewText: {
      color: themeTokens.text,
      fontSize: TEXT.sm,
      fontWeight: '600',
      lineHeight: 20,
    },
    modalInput: {
      minHeight: 118,
      borderRadius: RADIUS.md,
      backgroundColor: toRgba(themeTokens.surfaceAlt, isLightTheme ? 0.9 : 0.82),
      color: themeTokens.text,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: TEXT.sm,
      textAlignVertical: 'top',
      lineHeight: 20,
    },
    menuActions: {
      marginTop: SPACING.xs,
      gap: SPACING.xs,
    },
    menuActionButton: {
      minHeight: 42,
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.16 : 0.26),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    menuActionText: {
      color: isLightTheme ? themeTokens.text : themeTokens.textOnAccent,
      fontSize: TEXT.sm,
      fontWeight: '800',
    },
    menuDeleteButton: {
      minHeight: 42,
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.momentumDown, isLightTheme ? 0.2 : 0.3),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    menuDeleteText: {
      color: dangerText,
      fontSize: TEXT.sm,
      fontWeight: '900',
    },
    modalActions: {
      marginTop: SPACING.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: SPACING.sm,
    },
    modalCancelButton: {
      minHeight: 42,
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.surfaceAlt, isLightTheme ? 0.76 : 0.74),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    modalCancelText: {
      color: themeTokens.text,
      fontSize: TEXT.sm,
      fontWeight: '800',
    },
    modalDeleteButton: {
      minHeight: 42,
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.momentumDown, isLightTheme ? 0.2 : 0.3),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    modalDeleteText: {
      color: themeTokens.momentumDown,
      fontSize: TEXT.sm,
      fontWeight: '900',
    },
    modalSaveButton: {
      minHeight: 42,
      borderRadius: RADIUS.lg,
      backgroundColor: toRgba(themeTokens.accent, isLightTheme ? 0.34 : 0.48),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    modalSaveText: {
      color: themeTokens.textOnAccent,
      fontSize: TEXT.sm,
      fontWeight: '900',
    },
    toastContainer: {
      position: 'absolute',
      left: SCREEN_PADDING,
      right: SCREEN_PADDING,
      bottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    },
  });
}
