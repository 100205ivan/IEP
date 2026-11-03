"""Evaluate the upstream FER+ checkpoint, without training on held-out rows.

Reports both original FER2013 labels and independently published FER+ labels.
The checkpoint is upstream-pretrained, not one trained by this script.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import time
import zipfile

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.deps'))
import numpy as np
import onnxruntime as ort
from PIL import Image
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, confusion_matrix, f1_score

CLASSES = ['neutral', 'happy', 'surprise', 'sad', 'angry', 'disgust', 'fear', 'contempt']
COLUMNS = ['neutral', 'happiness', 'surprise', 'sadness', 'anger', 'disgust', 'fear', 'contempt', 'unknown', 'NF']
MAP_ORIGINAL = np.array([4, 5, 6, 1, 3, 2, 0])


def summary(y, p):
    predicted = p.argmax(1)
    return {'n': len(y), 'accuracy': float(accuracy_score(y, predicted)),
            'balanced_accuracy': float(balanced_accuracy_score(y, predicted)),
            'macro_f1': float(f1_score(y, predicted, labels=np.arange(8), average='macro', zero_division=0)),
            'confusion_matrix': confusion_matrix(y, predicted, labels=np.arange(8)).tolist(),
            'per_class': classification_report(y, predicted, labels=np.arange(8), target_names=CLASSES, output_dict=True, zero_division=0)}


if __name__ == '__main__':
    start = time.time()
    annotations = list(csv.DictReader((ROOT / 'data/ferplus-labels.csv').open(encoding='utf-8-sig')))
    with zipfile.ZipFile(ROOT / 'data/fer2013.zip') as archive:
        with archive.open('fer2013.csv') as source:
            originals = list(csv.DictReader(io.TextIOWrapper(source, encoding='utf-8-sig')))
    assert len(annotations) == len(originals)
    images, labels, old_labels, splits, fingerprints = [], [], [], [], []
    excluded = {'unknown_or_nonface': 0, 'duplicates': 0}
    for original, annotation in zip(originals, annotations):
        assert original['Usage'] == annotation['Usage']
        pixels = np.fromstring(original['pixels'], dtype=np.uint8, sep=' ').reshape(48, 48)
        votes = np.array([int(annotation[c]) for c in COLUMNS])
        label = votes.argmax()
        # Define the task before scoring: all eight expression labels retained;
        # only author-labelled unknown/non-face rows are outside this task.
        if label >= 8 or votes[:8].sum() == 0:
            excluded['unknown_or_nonface'] += 1
            continue
        image = np.asarray(Image.fromarray(pixels).resize((64, 64), Image.Resampling.LANCZOS), dtype=np.float32)
        images.append(image[None])
        labels.append(label)
        old_labels.append(MAP_ORIGINAL[int(original['emotion'])])
        splits.append(original['Usage'])
        fingerprints.append(hashlib.sha256(pixels.tobytes()).hexdigest())
    # The upstream model cannot be retrained retroactively for this comparison.
    # Remove held-out pixels that also occur in upstream training (and remove
    # PrivateTest duplicates of PublicTest used for upstream model selection).
    train_hashes = {fingerprint for fingerprint, split in zip(fingerprints, splits) if split == 'Training'}
    validation_hashes = {fingerprint for fingerprint, split in zip(fingerprints, splits) if split == 'PublicTest'}
    excluded['upstream_split_overlap'] = 0
    selected = {}
    priority = {'Training': 0, 'PublicTest': 1, 'PrivateTest': 2}
    for i, fingerprint in enumerate(fingerprints):
        if (splits[i] == 'PublicTest' and fingerprint in train_hashes) or (splits[i] == 'PrivateTest' and fingerprint in train_hashes | validation_hashes):
            excluded['upstream_split_overlap'] += 1
            continue
        if fingerprint not in selected or priority[splits[i]] > priority[splits[selected[fingerprint]]]:
            selected[fingerprint] = i
    excluded['duplicates'] = len(labels) - len(selected) - excluded['upstream_split_overlap']
    ix = np.array(sorted(selected.values()))
    x, y, old, usage = np.asarray(images)[ix], np.asarray(labels)[ix], np.asarray(old_labels)[ix], np.asarray(splits)[ix]
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    path = ROOT / 'data/pretrained-ferplus.onnx'
    session = ort.InferenceSession(str(path), options, providers=['CPUExecutionProvider'])
    input_name = session.get_inputs()[0].name
    batch_size = session.get_inputs()[0].shape[0]
    batch_size = batch_size if isinstance(batch_size, int) else 16
    report = {'model': 'Upstream ONNX Model Zoo Emotion FERPlus opset 8',
              'training': 'Upstream CNTK cross-entropy checkpoint; no local fine-tuning in this comparison',
              'source': 'https://github.com/onnx/models/tree/main/validated/vision/body_analysis/emotion_ferplus',
              'labels_source': 'https://github.com/microsoft/FERPlus', 'license': 'MIT',
              'model_sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'classes': CLASSES,
              'exclusions': excluded, 'threshold_applied_to_overall_accuracy': False,
              'limitations': ['No subject-disjoint guarantee: exact-pixel upstream split overlaps are excluded, near-duplicate identities may remain.',
                              'FER+ labels and original FER2013 labels define different evaluation tasks.',
                              'No evidence of accuracy on target students or internal emotion.'], 'splits': {}}
    probabilities = {}
    for split in ['PublicTest', 'PrivateTest']:
        indices = np.flatnonzero(usage == split)
        scores = []
        for offset in range(0, len(indices), batch_size):
            batch = x[indices[offset:offset + batch_size]]
            raw = session.run(None, {input_name: batch})[0]
            raw -= raw.max(1, keepdims=True)
            p = np.exp(raw)
            scores.append(p / p.sum(1, keepdims=True))
            if offset % 1000 == 0:
                print(f'{split}: {offset}/{len(indices)}', flush=True)
        p = np.concatenate(scores)
        probabilities[split] = (y[indices], p)
        report['splits'][split] = {'ferplus_labels': summary(y[indices], p), 'original_fer2013_labels_on_same_images': summary(old[indices], p)}
        print(json.dumps({'split': split, 'n': len(indices), 'ferplus_accuracy': report['splits'][split]['ferplus_labels']['accuracy'], 'original_label_accuracy': report['splits'][split]['original_fer2013_labels_on_same_images']['accuracy']}), flush=True)
    val_y, val_p = probabilities['PublicTest']
    threshold = 1.01
    for candidate in np.arange(.5, .96, .05):
        accepted = val_p.max(1) >= candidate
        if accepted.mean() >= .1 and accuracy_score(val_y[accepted], val_p[accepted].argmax(1)) >= .8:
            threshold = float(candidate)
            break
    report['validation_selected_rejection_threshold'] = threshold
    report['seconds'] = time.time() - start
    (ROOT / 'reports').mkdir(exist_ok=True)
    (ROOT / 'reports/emotion-ferplus.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    # A non-face synthetic input enables browser/Python parity testing.
    synthetic = np.linspace(0, 255, 4096, dtype=np.float32).reshape(1, 1, 64, 64)
    expected = session.run(None, {input_name: synthetic})[0][0].tolist()
    destination = ROOT.parent / 'frontend/public/vision/prototypes'
    destination.mkdir(exist_ok=True)
    (destination / 'emotion-ferplus.json').write_text(json.dumps({'architecture': 'onnx-ferplus-8', 'inputSize': 64, 'classes': CLASSES,
        'modelFile': 'emotion-ferplus-8.onnx', 'modelSha256': report['model_sha256'], 'threshold': threshold,
        'researchOnly': True, 'expectedSyntheticLogits': expected}, indent=2), encoding='utf-8')
    (destination / 'emotion-ferplus-8.onnx').write_bytes(path.read_bytes())
