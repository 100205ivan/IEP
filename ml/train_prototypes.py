"""Train two small image-classification research baselines, with held-out metrics.

Never interprets engagement labels as ground truth about a child's attention.
Exports plain TF-compatible weights; no converter, pickle, or remote code needed.
"""
import argparse
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import time
import zipfile

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
os.environ.setdefault('TF_ENABLE_ONEDNN_OPTS', '1')
import numpy as np
from PIL import Image, ImageOps
import tensorflow as tf
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedGroupKFold

ROOT = Path(__file__).resolve().parent
EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
ENGAGEMENT = ['disengaged', 'engaged']


def read_emotion():
    images, labels, splits, hashes = [], [], [], []
    with zipfile.ZipFile(ROOT / 'data/fer2013.zip') as archive:
        name = next(n for n in archive.namelist() if n.endswith('fer2013.csv'))
        with archive.open(name) as raw:
            for row in csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig')):
                pixels = np.fromstring(row['pixels'], sep=' ', dtype=np.uint8)
                if len(pixels) != 2304:
                    continue
                images.append(pixels.reshape(48, 48, 1))
                labels.append(int(row['emotion']))
                splits.append(row['Usage'])
                hashes.append(hashlib.sha256(pixels.tobytes()).hexdigest())
    # Assign duplicates to their final evaluation split; never leak held-out
    # pixels into training. Also remove repeated images inside each split.
    selected = {}
    priority = {'Training': 0, 'PublicTest': 1, 'PrivateTest': 2}
    for i, fingerprint in enumerate(hashes):
        if fingerprint not in selected or priority[splits[i]] > priority[splits[selected[fingerprint]]]:
            selected[fingerprint] = i
    indices = np.array(sorted(selected.values()))
    x, y = np.asarray(images)[indices], np.asarray(labels)[indices]
    usage = np.asarray(splits)[indices]
    return x, y, {s: np.flatnonzero(usage == name) for s, name in [('train', 'Training'), ('validation', 'PublicTest'), ('test', 'PrivateTest')]}, {
        'dataset': 'FER2013', 'source': 'https://www.kaggle.com/datasets/deadskull7/fer2013',
        'license_as_listed_by_publisher': 'CC0: Public Domain',
        'split': 'official Usage split with exact-pixel deduplication; no subject IDs available',
        'removed_exact_duplicates': len(images) - len(indices),
    }


def perceptual_group(image):
    gray = np.asarray(image.convert('L').resize((9, 8)))
    return np.packbits(gray[:, 1:] > gray[:, :-1]).tobytes().hex()


def read_engagement():
    images, labels, groups, seen, conflicts = [], [], [], {}, set()
    with zipfile.ZipFile(ROOT / 'data/engagement.zip') as archive:
        names = sorted(n for n in archive.namelist() if n.lower().endswith(('.jpg', '.jpeg', '.png')) and '__macosx' not in n.lower())
        for name in names:
            parts = [p.lower().strip() for p in name.replace('\\', '/').split('/')]
            if any('disengag' in p for p in parts):
                label = 0
            elif any(p in ('engagement', 'engaged') or p.startswith('engagement ') for p in parts):
                label = 1
            else:
                raise ValueError(f'Unrecognised label directory: {name}')
            with Image.open(io.BytesIO(archive.read(name))) as source:
                image = ImageOps.exif_transpose(source).convert('RGB')
                small = np.asarray(image.resize((64, 64), Image.Resampling.BILINEAR))
                fingerprint = hashlib.sha256(small.tobytes()).hexdigest()
                if fingerprint in seen:
                    if seen[fingerprint][1] != label:
                        conflicts.add(fingerprint)
                    continue
                seen[fingerprint] = (len(images), label)
                images.append(small)
                labels.append(label)
                groups.append(perceptual_group(image))
    x, y, groups = np.asarray(images), np.asarray(labels), np.asarray(groups)
    folds = list(StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42).split(x, y, groups))
    test, validation = folds[0][1], folds[1][1]
    train = np.setdiff1d(np.arange(len(y)), np.r_[test, validation])
    # Preserve the first fixed split for every unambiguous image; remove all
    # occurrences of conflicting labels without moving other images across it.
    keep = np.ones(len(y), dtype=bool)
    for fingerprint in conflicts:
        keep[seen[fingerprint][0]] = False
    remap = np.cumsum(keep) - 1
    train, validation, test = [remap[index[keep[index]]] for index in (train, validation, test)]
    x, y, groups = x[keep], y[keep], groups[keep]
    assert not set(groups[train]) & set(groups[test])
    assert not set(groups[train]) & set(groups[validation])
    return x, y, {'train': train, 'validation': validation, 'test': test}, {
        'dataset': 'E-learning Student Engagement and Disengagement Image Dataset',
        'source': 'https://zenodo.org/records/16731734', 'license': 'CC-BY-4.0',
        'creators': ['Parinita Chate', 'Kailas Patil'],
        'split': '60/20/20, exact resized-pixel deduplication and disjoint dHash clusters; not subject-disjoint',
        'limitations': ['Subject identities not provided: cross-person leakage may remain.',
                        'Whole-image labels may reflect pose, scene and background shortcuts.',
                        'Dataset engagement labels are not measurements of internal attention.'],
        'removed_exact_duplicates': len(names) - len(images),
        'removed_conflicting_unique_images': len(conflicts),
    }


def build_model(size, channels, classes):
    # Keep this exact architecture in sync with prototype-inference.js.
    model = tf.keras.Sequential([tf.keras.layers.Input((size, size, channels))])
    for filters in [16, 32, 64]:
        model.add(tf.keras.layers.Conv2D(filters, 3, padding='same', activation='relu'))
        model.add(tf.keras.layers.MaxPooling2D(2))
    model.add(tf.keras.layers.Flatten())
    model.add(tf.keras.layers.Dense(64, activation='relu'))
    model.add(tf.keras.layers.Dense(classes, activation='softmax'))
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    return model


def metrics(y, p, classes):
    prediction = p.argmax(1)
    return {'accuracy': float(accuracy_score(y, prediction)),
            'balanced_accuracy': float(balanced_accuracy_score(y, prediction)),
            'macro_f1': float(f1_score(y, prediction, labels=list(range(len(classes))), average='macro', zero_division=0)),
            'majority_baseline_accuracy': float(np.bincount(y, minlength=len(classes)).max() / len(y)),
            'confusion_matrix': confusion_matrix(y, prediction, labels=list(range(len(classes)))).tolist(),
            'per_class': classification_report(y, prediction, labels=list(range(len(classes))), target_names=classes, output_dict=True, zero_division=0)}


def train(task, epochs):
    start = time.time()
    tf.keras.utils.set_random_seed(42)
    x, y, split, provenance = read_emotion() if task == 'emotion' else read_engagement()
    classes = EMOTIONS if task == 'emotion' else ENGAGEMENT
    print(json.dumps({'task': task, 'shape': list(x.shape), 'splits': {k: len(v) for k, v in split.items()}, 'labels': classes}), flush=True)
    run = ROOT / 'runs' / task
    run.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(run / 'split.npz', **split)
    model = build_model(x.shape[1], x.shape[-1], len(classes))
    options = tf.data.Options()
    options.threading.private_threadpool_size = 4

    def dataset(indices, training=False):
        data = tf.data.Dataset.from_tensor_slices((x[indices], y[indices]))
        if training:
            data = data.shuffle(len(indices), seed=42)
        def prepare(image, label):
            image = tf.cast(image, tf.float32) / 255.
            if training:
                image = tf.image.random_flip_left_right(image)
            return image, label
        return data.map(prepare, num_parallel_calls=2).batch(64).prefetch(1).with_options(options)

    counts = np.bincount(y[split['train']], minlength=len(classes))
    weights = {i: float(len(split['train']) / (len(classes) * max(1, count))) for i, count in enumerate(counts)}
    history = model.fit(dataset(split['train'], True), validation_data=dataset(split['validation']), epochs=epochs,
                        class_weight=weights, verbose=2,
                        callbacks=[tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True),
                                   tf.keras.callbacks.CSVLogger(str(run / 'history.csv'))])
    val_p = model.predict(dataset(split['validation']), verbose=0)
    test_p = model.predict(dataset(split['test']), verbose=0)
    val_y, test_y = y[split['validation']], y[split['test']]
    # Select a rejection threshold on validation only, then freeze it for test.
    threshold = 1.01
    for candidate in np.arange(.5, .96, .05):
        accept = val_p.max(1) >= candidate
        if accept.mean() >= .1 and accuracy_score(val_y[accept], val_p[accept].argmax(1)) >= .7:
            threshold = float(candidate)
            break
    report = {'task': task, 'seed': 42, 'provenance': provenance, 'classes': classes,
              'split_counts': {k: len(v) for k, v in split.items()},
              'validation': metrics(val_y, val_p, classes), 'test': metrics(test_y, test_p, classes),
              'epochs_run': len(history.history['loss']), 'seconds': time.time() - start,
              'acceptance_threshold': threshold, 'threshold_rule': 'first validation threshold with >=70% accuracy and >=10% coverage; otherwise reject all',
              'research_only': True, 'validated_on_target_students': False}
    accepted = test_p.max(1) >= threshold
    report['test']['accepted_fraction'] = float(accepted.mean())
    report['test']['accepted_accuracy'] = float(accuracy_score(test_y[accepted], test_p[accepted].argmax(1))) if accepted.any() else None
    destination = ROOT.parent / 'frontend/public/vision/prototypes'
    destination.mkdir(parents=True, exist_ok=True)
    weights = model.get_weights()
    binary = b''.join(np.asarray(w, dtype='<f4').tobytes() for w in weights)
    (destination / f'{task}.weights.bin').write_bytes(binary)
    manifest = {'version': 1, 'architecture': 'eyeep-small-cnn-v1', 'inputSize': int(x.shape[1]), 'channels': int(x.shape[-1]),
                'classes': classes, 'weightShapes': [list(w.shape) for w in weights], 'weightsFile': f'{task}.weights.bin',
                'weightsSha256': hashlib.sha256(binary).hexdigest(), 'threshold': threshold, 'researchOnly': True}
    (destination / f'{task}.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    model.save(run / 'model.keras')
    reports = ROOT / 'reports'
    reports.mkdir(exist_ok=True)
    (reports / f'{task}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    # A deterministic real held-out input/output pair for Python/browser parity.
    probe = x[split['test'][0]].astype(np.float32) / 255.
    # Do not publish the original face image: use a deterministic synthetic
    # gradient for inference parity instead, which tests every model layer.
    probe = np.linspace(0, 1, probe.size, dtype=np.float32).reshape(probe.shape)
    expected = model.predict(probe[None], verbose=0)[0].tolist()
    (destination / f'{task}.parity.json').write_text(json.dumps({'expected': expected}), encoding='utf-8')
    print(json.dumps({'task': task, 'test': report['test'], 'seconds': report['seconds']}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--task', choices=['emotion', 'engagement', 'both'], default='both')
    parser.add_argument('--epochs', type=int, default=12)
    args = parser.parse_args()
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    for name in (['emotion', 'engagement'] if args.task == 'both' else [args.task]):
        train(name, args.epochs)
        tf.keras.backend.clear_session()
