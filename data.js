import { supabase } from "./supabaseClient.js";
import { voterId } from "./utils.js";

// ----------------------------------------------------------------------------
// Lecture des points visibles (par zone de la carte) — remplace le blob unique
// embarqué dans le prototype Artifact : à l'échelle nationale, on ne peut plus
// tout charger d'un coup (voir cadrage-projet.md, section "pilote multi-régions").
// ----------------------------------------------------------------------------
export async function fetchBinsInBounds(bounds) {
  // bounds: {west, south, east, north} (comme mapboxgl.LngLatBounds)
  const { data, error } = await supabase
    .from("all_bins")
    .select("id, lat, lon, category, subtypes, commune, source")
    .gte("lon", bounds.west).lte("lon", bounds.east)
    .gte("lat", bounds.south).lte("lat", bounds.north)
    .limit(5000); // filet de sécurité : au-delà, on incite à zoomer plutôt que de tout charger
  if (error) { console.error(error); return []; }
  return data;
}

export async function fetchBinById(id) {
  const { data } = await supabase.from("all_bins").select("*").eq("id", id).maybeSingle();
  return data;
}

// ----------------------------------------------------------------------------
// Signalements
// ----------------------------------------------------------------------------
export async function submitReport(binId, kind, photoBlob) {
  let photo_url = null;
  if (photoBlob) {
    const path = `${binId}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from("report-photos").upload(path, photoBlob, { contentType: "image/jpeg" });
    if (!upErr) {
      const { data } = supabase.storage.from("report-photos").getPublicUrl(path);
      photo_url = data.publicUrl;
    }
  }
  return supabase.from("reports").insert({ bin_id: binId, kind, photo_url, created_by: voterId() });
}

export function subscribeReports(onChange) {
  return supabase.channel("reports-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, onChange)
    .subscribe();
}

export async function fetchReportsForBin(binId) {
  const { data } = await supabase.from("reports").select("*").eq("bin_id", binId).order("created_at", { ascending: false });
  return data || [];
}

// ----------------------------------------------------------------------------
// Propositions communautaires + votes
// ----------------------------------------------------------------------------
export async function submitCommunityBin({ lat, lon, category, subtypes, commune, note }) {
  return supabase.from("community_bins").insert({ lat, lon, category, subtypes, commune, note, added_by: voterId() });
}

export async function submitVote(communityBinId, value) {
  return supabase.from("votes").upsert(
    { community_bin_id: communityBinId, voter_id: voterId(), value },
    { onConflict: "community_bin_id,voter_id" }
  );
}

export async function fetchVoteTally(communityBinId) {
  const { data } = await supabase.from("votes").select("value").eq("community_bin_id", communityBinId);
  const up = (data || []).filter((v) => v.value > 0).length;
  const down = (data || []).length - up;
  return { up, down, net: up - down };
}

export function subscribeCommunityBins(onChange) {
  return supabase.channel("community-bins-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "community_bins" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, onChange)
    .subscribe();
}

// ----------------------------------------------------------------------------
// Avis ("Donner un avis")
// ----------------------------------------------------------------------------
export async function submitFeedback(rating, comment) {
  return supabase.from("feedback").insert({ rating: rating || null, comment: comment || null, created_by: voterId() });
}

// ----------------------------------------------------------------------------
// Espace admin — vraie authentification Supabase (remplace le code en dur)
// ----------------------------------------------------------------------------
export async function adminSignIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}
export async function adminSignOut() {
  return supabase.auth.signOut();
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export async function isCurrentUserAdmin() {
  const session = await getSession();
  if (!session) return false;
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
  return !!data;
}
export async function fetchAllFeedback() {
  const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}
export async function fetchAllReportsForModeration() {
  const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
  return data || [];
}
export async function fetchAllCommunityBinsForModeration() {
  const { data } = await supabase.from("community_bins").select("*").order("created_at", { ascending: false }).limit(200);
  return data || [];
}
export async function deleteReport(id) {
  return supabase.from("reports").delete().eq("id", id);
}
export async function deleteCommunityBin(id) {
  return supabase.from("community_bins").delete().eq("id", id);
}
