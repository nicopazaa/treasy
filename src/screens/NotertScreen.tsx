import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppLanguage } from '../shared/types';
import type { NoteEntry } from '../features/workouts';
import { listNotes, replaceNotes } from '../features/notes';
import { formatRelativeDayLabel } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { UNDO_TIMEOUT_MS } from '../shared/constants';
import { UndoToast } from '../shared/ui/UndoToast';
import { t } from '../shared/i18n/i18n';

type Props = {
  language: AppLanguage;
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
  if (dateKey === 'unknown') {
    return language === 'nb' ? 'Ukjent dato' : language === 'es' ? 'Fecha desconocida' : 'Unknown date';
  }
  const dt = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(dt.getTime())) {
    return language === 'nb' ? 'Ukjent dato' : language === 'es' ? 'Fecha desconocida' : 'Unknown date';
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

export const NotertScreen: React.FC<Props> = ({ language, onBack }) => {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState>(null);
  const [deletedNotes, setDeletedNotes] = useState<NoteEntry[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const sorted = notes
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const groups: NoteGroup[] = [];
    for (const note of sorted) {
      const dateKey = typeof note.createdAt === 'string' && note.createdAt.length >= 10
        ? note.createdAt.slice(0, 10)
        : 'unknown';
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

  const emptyLabel =
    language === 'nb' ? 'Ingen notater enda' : language === 'es' ? 'No hay notas aun' : 'No notes yet';
  const deletingLabel = language === 'nb' ? 'Sletter...' : language === 'es' ? 'Eliminando...' : 'Deleting...';
  const emptyNotePreview =
    language === 'nb' ? '(tomt notat)' : language === 'es' ? '(nota vacia)' : '(empty note)';
  const shouldShowEmptyState = loading || grouped.length === 0;
  const titleLabel = language === 'nb' ? 'Notert' : language === 'es' ? 'Notas' : 'Notes';
  const doneLabel = language === 'nb' ? 'Ferdig' : language === 'es' ? 'Listo' : 'Done';
  const selectDeleteLabel = language === 'nb' ? 'Slett' : language === 'es' ? 'Eliminar' : 'Delete';
  const selectEditLabel = language === 'nb' ? 'Rediger' : language === 'es' ? 'Editar' : 'Edit';
  const selectedCount = selectedNoteIds.length;
  const selectedNote = selectedCount === 1 ? notes.find((note) => note.id === selectedNoteIds[0]) ?? null : null;
  const editModeTitle =
    editMode
      ? language === 'nb'
        ? `${selectedCount} valgt`
        : language === 'es'
          ? `${selectedCount} seleccionado`
          : `${selectedCount} selected`
      : titleLabel;
  const isBulkPendingDelete = pendingDelete?.mode === 'bulk';
  const pendingDeleteCount = pendingDelete?.notes.length ?? 0;
  const deleteConfirmTitle = isBulkPendingDelete
    ? language === 'nb'
      ? `Slette ${pendingDeleteCount} notater?`
      : language === 'es'
        ? `¿Eliminar ${pendingDeleteCount} notas?`
        : `Delete ${pendingDeleteCount} notes?`
    : language === 'nb'
      ? 'Slette notat?'
      : language === 'es'
        ? 'Eliminar nota?'
        : 'Delete note?';
  const deleteConfirmBody =
    language === 'nb'
      ? 'Dette kan ikke angres.'
      : language === 'es'
        ? 'Esto no se puede deshacer.'
        : 'This cannot be undone.';
  const deletePreviewLabel = isBulkPendingDelete
    ? language === 'nb'
      ? 'Valgt:'
      : language === 'es'
        ? 'Seleccionado:'
        : 'Selected:'
    : language === 'nb'
      ? 'Notat:'
      : language === 'es'
        ? 'Nota:'
        : 'Note:';
  const deletedLabel =
    deletedNotes && deletedNotes.length > 1
      ? language === 'nb'
        ? `${deletedNotes.length} notater slettet`
        : language === 'es'
          ? `${deletedNotes.length} notas eliminadas`
          : `${deletedNotes.length} notes deleted`
      : language === 'nb'
        ? 'Notat slettet'
        : language === 'es'
          ? 'Nota eliminada'
          : 'Note deleted';

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
    if (notes.length > 0) return;
    setEditMode(false);
    setSelectedNoteIds([]);
  }, [notes.length]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedNoteIds([]);
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
        if (mode === 'single') {
          setDeletingNoteId(entries[0]?.id ?? null);
        }

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
        setDeletingNoteId(null);
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
  const pendingPreviewSuffix =
    pendingDelete && pendingDelete.notes.length > 2 ? ` (+${pendingDelete.notes.length - 2})` : '';
  const pendingPreviewCombined = `${pendingPreviewRaw}${pendingPreviewSuffix}`;
  const modalPreviewText =
    pendingPreviewCombined.length === 0
      ? emptyNotePreview
      : pendingPreviewCombined.length > 84
        ? `${pendingPreviewCombined.slice(0, 81)}...`
        : pendingPreviewCombined;
  const anyDeleteBusy = deleteBusy;
  const modalDeleteBusy = deleteBusy;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={editMode ? exitEditMode : onBack}
            hitSlop={12}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <Text style={styles.backText}>{editMode ? doneLabel : t(language, 'back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editModeTitle}</Text>
        </View>
        {editMode ? (
          <View style={styles.headerActions}>
            {selectedCount === 1 ? (
              <TouchableOpacity
                style={[styles.headerActionButton, (anyDeleteBusy || editSaving) ? styles.headerActionButtonDisabled : null]}
                onPress={openEditModalForSelected}
                activeOpacity={0.85}
                disabled={anyDeleteBusy || editSaving}
              >
                <Text style={styles.headerActionText}>{selectEditLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.headerActionButtonDanger, (!selectedCount || anyDeleteBusy) ? styles.headerActionButtonDisabled : null]}
              onPress={openBulkDeleteModal}
              activeOpacity={0.85}
              disabled={!selectedCount || anyDeleteBusy}
            >
              <Text style={styles.headerActionTextDanger}>{selectDeleteLabel}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {shouldShowEmptyState ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {grouped.map((group) => (
            <View key={group.dateKey} style={styles.group}>
              <Text style={styles.groupTitle}>{group.label}</Text>
              <View style={styles.groupList}>
                {group.notes.map((note) => (
                  <Pressable
                    key={note.id}
                    onLongPress={() => enterEditMode(note.id)}
                    delayLongPress={220}
                    onPress={() => {
                      if (!editMode) return;
                      toggleSelectedNote(note.id);
                    }}
                    style={({ pressed }) => [
                      styles.noteCard,
                      editMode ? styles.noteCardSelectable : null,
                      selectedNoteIds.includes(note.id) ? styles.noteCardSelected : null,
                      pressed ? styles.noteCardPressed : null,
                    ]}
                  >
                    <View style={styles.noteHeader}>
                      <Text style={styles.noteTime}>{formatTime(note.createdAt, language)}</Text>
                      {editMode ? (
                        <View
                          style={[
                            styles.noteSelectPill,
                            selectedNoteIds.includes(note.id) ? styles.noteSelectPillActive : null,
                          ]}
                        >
                          <Text style={styles.noteSelectPillText}>
                            {selectedNoteIds.includes(note.id) ? '\u2713' : ''}
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          hitSlop={8}
                          style={[styles.noteDeleteButton, anyDeleteBusy ? styles.noteDeleteButtonDisabled : null]}
                          onPress={() => {
                            if (anyDeleteBusy) return;
                            setPendingDelete({ mode: 'single', notes: [note] });
                          }}
                          activeOpacity={0.75}
                          disabled={anyDeleteBusy}
                        >
                          <Text style={[styles.noteDeleteText, deletingNoteId === note.id ? styles.noteDeleteTextDisabled : null]}>
                            {deletingNoteId === note.id ? deletingLabel : t(language, 'delete')}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.noteText}>{note.text}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

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
                style={[styles.modalCancelButton, anyDeleteBusy ? styles.modalCancelButtonDisabled : null]}
                onPress={closeDeleteModal}
                activeOpacity={0.9}
                disabled={anyDeleteBusy}
              >
                <Text style={styles.modalCancelText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteButton, modalDeleteBusy ? styles.modalDeleteButtonDisabled : null]}
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
            {modalDeleteBusy ? <Text style={styles.modalLoadingText}>{deletingLabel}</Text> : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={Boolean(editingNoteId)} transparent animationType="fade" onRequestClose={closeEditModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeEditModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{selectEditLabel}</Text>
            <Text style={styles.modalBody}>
              {language === 'nb'
                ? 'Oppdater notatet ditt.'
                : language === 'es'
                  ? 'Actualiza tu nota.'
                  : 'Update your note.'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editingText}
              onChangeText={setEditingText}
              multiline
              autoFocus
              editable={!editSaving}
              placeholder={emptyNotePreview}
              placeholderTextColor="#64748B"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, editSaving ? styles.modalCancelButtonDisabled : null]}
                onPress={closeEditModal}
                activeOpacity={0.9}
                disabled={editSaving}
              >
                <Text style={styles.modalCancelText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, (editSaving || editingText.trim().length === 0) ? styles.modalDeleteButtonDisabled : null]}
                onPress={() => {
                  void handleSaveEditedNote();
                }}
                activeOpacity={0.9}
                disabled={editSaving || editingText.trim().length === 0}
              >
                <Text style={styles.modalSaveText}>{language === 'nb' ? 'Lagre' : language === 'es' ? 'Guardar' : 'Save'}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minWidth: 0,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  headerActionButton: {
    minHeight: 32,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonDanger: {
    minHeight: 32,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#3B0B0B',
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonDisabled: {
    opacity: 0.55,
  },
  headerActionText: {
    color: '#CBD5E1',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  headerActionTextDanger: {
    color: '#FCA5A5',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  title: {
    color: '#F9FAFB',
    fontSize: TEXT.xl,
    fontWeight: '800',
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.xxxl,
  },
  group: {
    marginBottom: SPACING.xl,
  },
  groupTitle: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '800',
    marginBottom: SPACING.sm,
    textTransform: 'capitalize',
  },
  groupList: {
    gap: SPACING.sm,
  },
  noteCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  noteCardSelectable: {
    paddingLeft: SPACING.sm,
  },
  noteCardSelected: {
    borderColor: '#60A5FA',
    backgroundColor: '#101C32',
  },
  noteCardPressed: {
    opacity: 0.92,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  noteTime: {
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  noteDeleteButton: {
    minHeight: 28,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  noteDeleteButtonDisabled: {
    opacity: 0.65,
  },
  noteDeleteText: {
    color: '#F87171',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  noteDeleteTextDisabled: {
    color: '#94A3B8',
  },
  noteSelectPill: {
    minWidth: 24,
    minHeight: 24,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  noteSelectPillActive: {
    borderColor: '#60A5FA',
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
  },
  noteSelectPillText: {
    color: '#BFDBFE',
    fontSize: TEXT.xs,
    fontWeight: '900',
    lineHeight: TEXT.xs + 1,
  },
  noteText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  emptyState: {
    paddingHorizontal: SCREEN_PADDING,
    marginTop: SPACING.xxl,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  modalCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...Platform.select({
      web: { maxWidth: 520, width: '100%', alignSelf: 'center' },
      default: undefined,
    }),
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '800',
  },
  modalBody: {
    color: '#CBD5E1',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  modalPreviewLabel: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  modalPreviewText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  modalInput: {
    minHeight: 110,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
    color: '#E5E7EB',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TEXT.sm,
    textAlignVertical: 'top',
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
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalCancelButtonDisabled: {
    opacity: 0.65,
  },
  modalCancelText: {
    color: '#CBD5E1',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  modalDeleteButton: {
    minHeight: 42,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#3B0B0B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalDeleteButtonDisabled: {
    opacity: 0.7,
  },
  modalDeleteText: {
    color: '#FCA5A5',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  modalSaveButton: {
    minHeight: 42,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  modalSaveText: {
    color: '#EAF2FF',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  modalLoadingText: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  toastContainer: {
    position: 'absolute',
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
    bottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
  },
});
