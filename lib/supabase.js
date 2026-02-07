import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Browser client (used in components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper: Get submission by access token (for client intake form)
export async function getSubmissionByToken(token) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('access_token', token)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching submission:', error);
    return null;
  }
  return data;
}

// Helper: Create new submission and return token
export async function createSubmission(vertical = 'home_services') {
  const { data, error } = await supabase
    .from('submissions')
    .insert({ vertical, status: 'draft' })
    .select('id, access_token')
    .single();
  
  if (error) {
    console.error('Error creating submission:', error);
    return null;
  }
  return data;
}

// Helper: Update submission fields
export async function updateSubmission(id, fields) {
  const { data, error } = await supabase
    .from('submissions')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating submission:', error);
    return null;
  }
  return data;
}

// Helper: Get all submissions (for admin dashboard)
export async function getAllSubmissions() {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, business_name, vertical, status, email, primary_phone, created_at, updated_at, duda_site_url, duda_published_url')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
  return data;
}

// Helper: Get full submission with all related data (for admin detail view)
export async function getFullSubmission(id) {
  const [submission, services, testimonials, hours, portfolio, teamBios, buildLogs] = await Promise.all([
    supabase.from('submissions').select('*').eq('id', id).single(),
    supabase.from('services').select('*').eq('submission_id', id).order('sort_order'),
    supabase.from('testimonials').select('*').eq('submission_id', id).order('sort_order'),
    supabase.from('business_hours').select('*').eq('submission_id', id).order('sort_order'),
    supabase.from('portfolio_items').select('*').eq('submission_id', id).order('sort_order'),
    supabase.from('team_bios').select('*').eq('submission_id', id).order('sort_order'),
    supabase.from('build_logs').select('*').eq('submission_id', id).order('started_at', { ascending: false }),
  ]);

  return {
    ...submission.data,
    services: services.data || [],
    testimonials: testimonials.data || [],
    business_hours: hours.data || [],
    portfolio_items: portfolio.data || [],
    team_bios: teamBios.data || [],
    build_logs: buildLogs.data || [],
  };
}

// Helper: Add/update services for a submission
export async function upsertServices(submissionId, servicesList) {
  // Delete existing then insert fresh
  await supabase.from('services').delete().eq('submission_id', submissionId);
  
  if (servicesList.length === 0) return [];
  
  const rows = servicesList.map((s, i) => ({
    submission_id: submissionId,
    service_name: s.service_name,
    category: s.category || null,
    description: s.description || null,
    ai_description: s.ai_description || null,
    price_range: s.price_range || null,
    is_emergency: s.is_emergency || false,
    sort_order: i,
  }));

  const { data, error } = await supabase.from('services').insert(rows).select();
  if (error) console.error('Error upserting services:', error);
  return data || [];
}

// Helper: Add/update testimonials for a submission
export async function upsertTestimonials(submissionId, testimonialsList) {
  await supabase.from('testimonials').delete().eq('submission_id', submissionId);
  
  if (testimonialsList.length === 0) return [];
  
  const rows = testimonialsList.map((t, i) => ({
    submission_id: submissionId,
    quote_text: t.quote_text,
    author_name: t.author_name || null,
    author_city: t.author_city || null,
    rating: t.rating || 5,
    service_type: t.service_type || null,
    sort_order: i,
  }));

  const { data, error } = await supabase.from('testimonials').insert(rows).select();
  if (error) console.error('Error upserting testimonials:', error);
  return data || [];
}

// Helper: Add/update business hours
export async function upsertBusinessHours(submissionId, hoursList) {
  await supabase.from('business_hours').delete().eq('submission_id', submissionId);
  
  if (hoursList.length === 0) return [];
  
  const rows = hoursList.map((h, i) => ({
    submission_id: submissionId,
    day_of_week: h.day_of_week,
    open_time: h.open_time || null,
    close_time: h.close_time || null,
    is_closed: h.is_closed || false,
    sort_order: i,
  }));

  const { data, error } = await supabase.from('business_hours').insert(rows).select();
  if (error) console.error('Error upserting hours:', error);
  return data || [];
}

// Helper: Upload file to Supabase Storage
export async function uploadFile(submissionId, file, fileType) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${submissionId}/${fileType}-${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('client-uploads')
    .upload(fileName, file);
  
  if (error) {
    console.error('Error uploading file:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('client-uploads')
    .getPublicUrl(fileName);

  // Track in file_uploads table
  await supabase.from('file_uploads').insert({
    submission_id: submissionId,
    file_name: file.name,
    file_type: fileType,
    storage_path: fileName,
    public_url: urlData.publicUrl,
    file_size_bytes: file.size,
  });

  return urlData.publicUrl;
}
