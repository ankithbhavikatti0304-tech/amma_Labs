import { api, ApiError } from '@/server/http';
import { savePrescription } from '@/server/prescriptions';
import { MAX_UPLOAD_BYTES } from '@/server/files';

export const POST = api({ auth: 'user', limit: { name: 'rx-upload', max: 6, windowSec: 3600 } }, async ({ req, user }) => {
  // Refuse oversized bodies before reading them.
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new ApiError(413, 'file_too_large', 'That file is over 5 MB. Please choose a smaller one.');
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, 'bad_form', 'Could not read the upload.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'no_file', 'Choose a file to upload.');
  return savePrescription(user, file);
});
