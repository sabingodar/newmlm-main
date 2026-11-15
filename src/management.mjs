import {fail} from './validation.mjs';

export const managementDefaults = {
  chairman: {post:'Chairman', message:'Welcome to Dynamic Life Success. Our commitment is to build lasting relationships through trust, quality and mutual respect. Thank you for being part of our journey.'},
  managingDirector: {post:'Managing Director', message:'We work to make everyday essentials accessible and to support the people who bring them to our customers. We welcome your feedback as we grow together.'},
  director: {post:'Director', message:'Our team works together to serve our customers and partners with care. We value open communication and look forward to strengthening those relationships.'},
  team: []
};

export async function validateManagement(db, input) {
  if (!input || !Array.isArray(input.team) || input.team.length > 50) fail('Enter a valid management team (maximum 50 members)');
  const photoIds = new Set();
  function profile(row, required) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) fail('Invalid management profile');
    const result = {};
    for (const [key, limit] of Object.entries({name:120, post:120, email:254, phone:40, imageUrl:50, message:6000})) {
      const value = row[key] ?? '';
      if (typeof value !== 'string' || value.trim().length > limit) fail('Invalid profile ' + key);
      result[key] = value.trim();
    }
    if (!result.post || (required && !result.name)) fail('Enter a post for each profile and a name for each team member');
    if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fail('Enter a valid profile email');
    if (result.phone && !/^\+?[0-9][0-9(). -]*$/.test(result.phone)) fail('Enter a valid profile phone number');
    if (result.imageUrl) {
      if (!/^\/assets\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(result.imageUrl)) fail('Upload a profile photo');
      photoIds.add(result.imageUrl.split('/').pop());
    }
    return result;
  }
  const result = {
    chairman: profile(input.chairman, false),
    managingDirector: profile(input.managingDirector, false),
    director: profile(input.director, false),
    team: input.team.map(row => profile(row, true))
  };
  if (photoIds.size) {
    const {rowCount} = await db.query('SELECT id FROM media_assets WHERE id = ANY($1::uuid[])', [[...photoIds]]);
    if (rowCount !== photoIds.size) fail('An uploaded profile photo was not found');
  }
  return result;
}
